"""SQLite storage for the prototype. Uses only the standard library.

Swap for PostgreSQL later by re-implementing this class. The API layer only calls these methods.
"""
from __future__ import annotations

import sqlite3
import threading
import time
from typing import Optional

from .validation import iso_z
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  ts_ms INTEGER NOT NULL,
  received_ms INTEGER NOT NULL,
  mode TEXT NOT NULL DEFAULT 'live',
  tds_ppm REAL, temperature_c REAL, flow_lpm REAL, turbidity_ntu REAL,
  pump_commanded INTEGER NOT NULL, pump_state TEXT NOT NULL,
  tds_status TEXT NOT NULL, temperature_status TEXT NOT NULL, flow_status TEXT NOT NULL, turbidity_status TEXT NOT NULL,
  timestamp_from_server INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_readings_dev_ts ON readings(device_id, ts_ms);
CREATE UNIQUE INDEX IF NOT EXISTS idx_readings_unique ON readings(device_id, ts_ms);

CREATE TABLE IF NOT EXISTS commands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  desired TEXT NOT NULL,
  status TEXT NOT NULL,            -- pending | acknowledged | failed
  detail TEXT,
  created_ms INTEGER NOT NULL,
  updated_ms INTEGER NOT NULL
);
"""


def _row_to_record(r: sqlite3.Row) -> dict:
    return {
        "device_id": r["device_id"],
        "timestamp": r["timestamp"],
        "ts_ms": r["ts_ms"],
        "mode": r["mode"],
        "tds_ppm": r["tds_ppm"],
        "temperature_c": r["temperature_c"],
        "flow_lpm": r["flow_lpm"],
        "turbidity_ntu": r["turbidity_ntu"],
        "pump_commanded": bool(r["pump_commanded"]),
        "pump_state": r["pump_state"],
        "sensor_status": {
            "tds": r["tds_status"], "temperature": r["temperature_status"],
            "flow": r["flow_status"], "turbidity": r["turbidity_status"],
        },
    }


class Store:
    def __init__(self, path: str):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        with self._lock:
            self._db.executescript(SCHEMA)
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    # ---- readings ----
    def insert_reading(self, rec: dict) -> bool:
        """Returns False when a record with the same device and timestamp already exists."""
        s = rec["sensor_status"]
        with self._lock:
            try:
                self._db.execute(
                    """INSERT INTO readings (device_id,timestamp,ts_ms,received_ms,mode,tds_ppm,temperature_c,flow_lpm,turbidity_ntu,
                       pump_commanded,pump_state,tds_status,temperature_status,flow_status,turbidity_status,timestamp_from_server)
                       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (rec["device_id"], rec["timestamp"], rec["ts_ms"], int(time.time() * 1000), rec["mode"],
                     rec["tds_ppm"], rec["temperature_c"], rec["flow_lpm"], rec["turbidity_ntu"],
                     int(rec["pump_commanded"]), rec["pump_state"],
                     s["tds"], s["temperature"], s["flow"], s["turbidity"], int(rec.get("timestamp_from_server", False))),
                )
                self._db.commit()
                return True
            except sqlite3.IntegrityError:
                return False

    def latest(self, device_id: str) -> Optional[dict]:
        with self._lock:
            r = self._db.execute(
                "SELECT * FROM readings WHERE device_id=? ORDER BY ts_ms DESC LIMIT 1", (device_id,)
            ).fetchone()
        return _row_to_record(r) if r else None

    def range(self, device_id: str, from_ms: int, to_ms: int, limit: int = 5000) -> list[dict]:
        """Oldest first. When more than `limit` rows match, the newest `limit` are returned."""
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM (SELECT * FROM readings WHERE device_id=? AND ts_ms BETWEEN ? AND ? ORDER BY ts_ms DESC LIMIT ?) ORDER BY ts_ms ASC",
                (device_id, from_ms, to_ms, limit),
            ).fetchall()
        return [_row_to_record(r) for r in rows]

    def recent(self, device_id: str, n: int = 600) -> list[dict]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM (SELECT * FROM readings WHERE device_id=? ORDER BY ts_ms DESC LIMIT ?) ORDER BY ts_ms ASC",
                (device_id, n),
            ).fetchall()
        return [_row_to_record(r) for r in rows]

    def devices(self) -> list[str]:
        with self._lock:
            return [r[0] for r in self._db.execute("SELECT DISTINCT device_id FROM readings")]

    # ---- commands ----
    def create_command(self, device_id: str, kind: str, desired: str) -> dict:
        now = int(time.time() * 1000)
        with self._lock:
            cur = self._db.execute(
                "INSERT INTO commands (device_id,kind,desired,status,detail,created_ms,updated_ms) VALUES (?,?,?,?,?,?,?)",
                (device_id, kind, desired, "pending", None, now, now),
            )
            self._db.commit()
            cid = cur.lastrowid
        return self.get_command(cid)  # type: ignore[return-value]

    def get_command(self, cid: int) -> Optional[dict]:
        with self._lock:
            r = self._db.execute("SELECT * FROM commands WHERE id=?", (cid,)).fetchone()
        return self._cmd(r) if r else None

    def last_command(self, device_id: str, kind: str) -> Optional[dict]:
        with self._lock:
            r = self._db.execute(
                "SELECT * FROM commands WHERE device_id=? AND kind=? ORDER BY id DESC LIMIT 1", (device_id, kind)
            ).fetchone()
        return self._cmd(r) if r else None

    def next_pending(self, device_id: str) -> Optional[dict]:
        with self._lock:
            r = self._db.execute(
                "SELECT * FROM commands WHERE device_id=? AND status='pending' ORDER BY id ASC LIMIT 1", (device_id,)
            ).fetchone()
        return self._cmd(r) if r else None

    def resolve_command(self, cid: int, ok: bool, detail: Optional[str]) -> Optional[dict]:
        with self._lock:
            cur = self._db.execute(
                "UPDATE commands SET status=?, detail=?, updated_ms=? WHERE id=? AND status='pending'",
                ("acknowledged" if ok else "failed", detail, int(time.time() * 1000), cid),
            )
            self._db.commit()
            if cur.rowcount == 0:
                return None
        return self.get_command(cid)

    @staticmethod
    def _cmd(r: sqlite3.Row) -> dict:
        return {
            "id": r["id"], "device_id": r["device_id"], "kind": r["kind"], "desired": r["desired"],
            "status": r["status"], "detail": r["detail"],
            "created": iso_z(datetime.fromtimestamp(r["created_ms"] / 1000, timezone.utc)),
            "updated": iso_z(datetime.fromtimestamp(r["updated_ms"] / 1000, timezone.utc)),
        }
