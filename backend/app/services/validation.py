"""Telemetry validation. Pure Python so it can be tested without the web framework.

Rules (from the project README):
- null means unavailable. Zero is never used as a substitute.
- A value outside its plausible range is stored as null with status "out_of_range".
- Turbidity stays null / "not_installed" until a sensor exists.
- Every record has a timestamp. A missing one is filled with the server receive time and marked.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from ..config import RANGES

SENSOR_STATUSES = {"valid", "disconnected", "out_of_range", "not_installed", "unknown"}
PUMP_STATES = {"on", "off", "fault", "unknown"}


class ValidationError(ValueError):
    pass


def parse_iso(ts: str) -> datetime:
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    except Exception as e:  # noqa: BLE001
        raise ValidationError(f"timestamp is not ISO 8601: {ts!r}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def iso_z(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _num(v: Any) -> Optional[float]:
    if v is None or isinstance(v, bool):
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    if f != f or f in (float("inf"), float("-inf")):
        return None
    return f


def sanitize(payload: dict, *, now: Optional[datetime] = None) -> dict:
    """Return a normalized telemetry record, or raise ValidationError."""
    if not isinstance(payload, dict):
        raise ValidationError("payload must be a JSON object")
    device_id = payload.get("device_id")
    if not isinstance(device_id, str) or not device_id.strip() or len(device_id) > 64:
        raise ValidationError("device_id is required (1 to 64 characters)")

    now = now or datetime.now(timezone.utc)
    ts_raw = payload.get("timestamp")
    timestamp_missing = ts_raw in (None, "")
    ts = now if timestamp_missing else parse_iso(str(ts_raw))
    if (ts - now).total_seconds() > 300:
        raise ValidationError("timestamp is more than 5 minutes in the future")

    incoming = payload.get("sensor_status") or {}
    status = {}
    values = {}
    for key, col in (("tds", "tds_ppm"), ("temperature", "temperature_c"), ("flow", "flow_lpm")):
        st = incoming.get(key, "valid" if payload.get(col) is not None else "unknown")
        if st not in SENSOR_STATUSES:
            st = "unknown"
        v = _num(payload.get(col))
        lo, hi = RANGES[col]
        if st == "valid":
            if v is None:
                st = "unknown"
            elif not (lo <= v <= hi):
                st, v = "out_of_range", None
        else:
            v = None  # a non-valid sensor never carries a number
        status[key], values[col] = st, v

    # Turbidity: not installed. Ignore any value sent.
    status["turbidity"] = "not_installed"
    values["turbidity_ntu"] = None

    pump_state = payload.get("pump_state", "unknown")
    if pump_state not in PUMP_STATES:
        pump_state = "unknown"

    return {
        "device_id": device_id.strip(),
        "timestamp": iso_z(ts),
        "ts_ms": int(ts.timestamp() * 1000),
        "mode": "live",
        **values,
        "pump_commanded": bool(payload.get("pump_commanded", False)),
        "pump_state": pump_state,
        "sensor_status": status,
        "timestamp_from_server": timestamp_missing,
    }
