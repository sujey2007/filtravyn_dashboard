"""FiltraVyn backend (FastAPI). Run: uvicorn app.main:app --reload --port 8000"""
from __future__ import annotations

import asyncio
import hmac
import json
import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import Settings, load_settings
from .services import diagnostics
from .services.mqtt_bridge import start_bridge
from .services.store import Store
from .services.validation import ValidationError, iso_z, parse_iso, sanitize

log = logging.getLogger("filtravyn")
DEFAULT_DEVICE = "filtravyn-001"
MODEL_CONFIG = Path(__file__).resolve().parents[2] / "frontend" / "public" / "models" / "model.config.json"


def _env_file() -> None:
    """Load backend/.env if present (simple KEY=VALUE parser, no extra dependency)."""
    import os

    p = Path(__file__).resolve().parents[1] / ".env"
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())


class Hub:
    """Fan-out of new records to WebSocket clients."""

    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def broadcast(self, rec: dict) -> None:
        dead = []
        for ws in self.clients:
            try:
                await ws.send_text(json.dumps(rec))
            except Exception:  # noqa: BLE001
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)


def _public(rec: dict) -> dict:
    return {k: v for k, v in rec.items() if k not in ("ts_ms", "timestamp_from_server")}


def _same(a: str, b: str) -> bool:
    return bool(a) and hmac.compare_digest(a.encode(), b.encode())


class PumpRequest(BaseModel):
    state: Literal["on", "off"]
    device_id: str = Field(default=DEFAULT_DEVICE, max_length=64)


class AckRequest(BaseModel):
    ok: bool
    detail: Optional[str] = Field(default=None, max_length=200)


def create_app(settings: Optional[Settings] = None) -> FastAPI:
    _env_file()
    cfg = settings or load_settings()
    store = Store(cfg.database_path)
    hub = Hub()
    loop_ref: dict = {}

    def ingest(rec: dict) -> bool:
        stored = store.insert_reading(rec)
        loop = loop_ref.get("loop")
        if stored and loop and loop.is_running():
            asyncio.run_coroutine_threadsafe(hub.broadcast(_public(rec)), loop)
        return stored

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        loop_ref["loop"] = asyncio.get_running_loop()
        client = start_bridge(cfg, ingest)
        yield
        if client is not None:
            client.loop_stop()
            client.disconnect()
        store.close()

    app = FastAPI(title="FiltraVyn API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=cfg.cors_origins, allow_methods=["GET", "POST"], allow_headers=["*"])

    def device_key(x_device_key: str = Header(default="")) -> None:
        if not cfg.device_api_key:
            raise HTTPException(503, "Telemetry ingest is disabled. Set DEVICE_API_KEY in backend/.env.")
        if not _same(cfg.device_api_key, x_device_key):
            raise HTTPException(401, "Invalid device key.")

    def admin_key(x_api_key: str = Header(default="")) -> None:
        if not cfg.admin_api_key:
            raise HTTPException(503, "Admin access is not configured. Set ADMIN_API_KEY in backend/.env.")
        if not _same(cfg.admin_api_key, x_api_key):
            raise HTTPException(401, "Invalid API key.")

    def connection(device_id: str) -> tuple[str, Optional[str]]:
        last = store.latest(device_id)
        if not last:
            return "unknown", None
        age = time.time() - last["ts_ms"] / 1000
        t = cfg.thresholds.stale_timeout_s
        state = "online" if age <= t else "stale" if age <= t * 4 else "offline"
        return state, last["timestamp"]

    @app.get("/api/health")
    def health():
        return {"status": "ok", "time": iso_z(datetime.now(timezone.utc))}

    @app.get("/api/device")
    def device(device_id: str = DEFAULT_DEVICE):
        state, seen = connection(device_id)
        return {"device_id": device_id, "connection": state, "last_seen": seen, "firmware": None,
                "pump_control_enabled": cfg.pump_control_enabled}

    @app.post("/api/telemetry", status_code=201, dependencies=[Depends(device_key)])
    def post_telemetry(payload: dict):
        try:
            rec = sanitize(payload)
        except ValidationError as e:
            raise HTTPException(422, str(e)) from e
        if not ingest(rec):
            raise HTTPException(409, "A record for this device and timestamp already exists.")
        return _public(rec)

    @app.get("/api/readings/latest")
    def latest(device_id: str = DEFAULT_DEVICE):
        rec = store.latest(device_id)
        if not rec:
            raise HTTPException(404, "No telemetry received yet.")
        return _public(rec)

    @app.get("/api/readings")
    def readings(
        from_: str = Query(alias="from"),
        to: Optional[str] = None,
        device_id: str = DEFAULT_DEVICE,
        limit: int = Query(5000, ge=1, le=20000),
    ):
        try:
            f = parse_iso(from_)
            t = parse_iso(to) if to else datetime.now(timezone.utc)
        except ValidationError as e:
            raise HTTPException(422, str(e)) from e
        return [_public(r) for r in store.range(device_id, int(f.timestamp() * 1000), int(t.timestamp() * 1000), limit)]

    @app.get("/api/alerts")
    def alerts(device_id: str = DEFAULT_DEVICE):
        return diagnostics.evaluate(store.recent(device_id), int(time.time() * 1000), cfg.thresholds)

    @app.get("/api/model/config")
    def model_config():
        try:
            data = json.loads(MODEL_CONFIG.read_text())
            return {k: v for k, v in data.items() if not k.startswith("_")}
        except (OSError, ValueError):
            return {"asset": None, "mapping": {}, "pipeRoute": None}

    # ---- pump control: off by default, never reports success before the device acknowledges ----
    @app.post("/api/device/pump", status_code=202, dependencies=[Depends(admin_key)])
    def pump(req: PumpRequest):
        if not cfg.pump_control_enabled:
            raise HTTPException(403, "Pump control is disabled. The dashboard stays read-only.")
        state, _ = connection(req.device_id)
        if state != "online":
            raise HTTPException(409, f"Device is {state}. Commands are only accepted while it is online.")
        prev = store.last_command(req.device_id, "pump")
        if prev and prev["status"] == "pending":
            raise HTTPException(409, "A pump command is already pending.")
        if prev:
            age = time.time() - parse_iso(prev["created"]).timestamp()
            if age < cfg.pump_min_interval_s:
                raise HTTPException(429, f"Wait {cfg.pump_min_interval_s - age:.0f} s before sending another pump command.")
        return store.create_command(req.device_id, "pump", req.state)

    @app.get("/api/device/pump/{command_id}")
    def pump_status(command_id: int):
        c = store.get_command(command_id)
        if not c:
            raise HTTPException(404, "Unknown command.")
        return c

    @app.get("/api/device/commands/pending", dependencies=[Depends(device_key)])
    def pending(device_id: str = DEFAULT_DEVICE):
        c = store.next_pending(device_id)
        if not c:
            return {"command": None}
        return {"command": c}

    @app.post("/api/device/commands/{command_id}/ack", dependencies=[Depends(device_key)])
    def ack(command_id: int, body: AckRequest):
        c = store.resolve_command(command_id, body.ok, body.detail)
        if not c:
            raise HTTPException(409, "Command is unknown or already resolved.")
        return c

    @app.websocket("/ws/telemetry")
    async def ws(socket: WebSocket):
        await socket.accept()
        hub.clients.add(socket)
        try:
            while True:
                await socket.receive_text()  # keep-alive; clients send nothing meaningful
        except WebSocketDisconnect:
            pass
        finally:
            hub.clients.discard(socket)

    return app


app = create_app()
