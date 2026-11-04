"""Run: python -m unittest discover -s tests -v   (from the backend folder; needs no third-party packages)"""
import time
import unittest
from datetime import datetime, timedelta, timezone

from app.config import Thresholds
from app.services import diagnostics
from app.services.store import Store
from app.services.validation import ValidationError, sanitize

NOW = datetime(2026, 11, 1, 12, 0, 0, tzinfo=timezone.utc)


def rec(offset_s=0, **kw):
    base = {
        "device_id": "filtravyn-001",
        "timestamp": (NOW + timedelta(seconds=offset_s)).isoformat(),
        "tds_ppm": 240, "temperature_c": 29.0, "flow_lpm": 1.2,
        "pump_commanded": True, "pump_state": "on",
        "sensor_status": {"tds": "valid", "temperature": "valid", "flow": "valid"},
    }
    base.update(kw)
    return sanitize(base, now=NOW + timedelta(seconds=offset_s))


class Validation(unittest.TestCase):
    def test_turbidity_always_unavailable(self):
        r = sanitize({"device_id": "d", "timestamp": NOW.isoformat(), "turbidity_ntu": 3.2}, now=NOW)
        self.assertIsNone(r["turbidity_ntu"])
        self.assertEqual(r["sensor_status"]["turbidity"], "not_installed")

    def test_out_of_range_becomes_null_not_zero(self):
        r = rec(tds_ppm=5000)
        self.assertIsNone(r["tds_ppm"])
        self.assertEqual(r["sensor_status"]["tds"], "out_of_range")

    def test_disconnected_sensor_carries_no_number(self):
        r = rec(flow_lpm=1.0, sensor_status={"tds": "valid", "temperature": "valid", "flow": "disconnected"})
        self.assertIsNone(r["flow_lpm"])
        self.assertEqual(r["sensor_status"]["flow"], "disconnected")

    def test_missing_value_is_unknown_not_valid(self):
        r = sanitize({"device_id": "d", "timestamp": NOW.isoformat()}, now=NOW)
        self.assertEqual(r["sensor_status"]["tds"], "unknown")
        self.assertIsNone(r["tds_ppm"])

    def test_missing_timestamp_uses_server_time_and_is_marked(self):
        r = sanitize({"device_id": "d"}, now=NOW)
        self.assertTrue(r["timestamp_from_server"])
        self.assertTrue(r["timestamp"].endswith("Z"))

    def test_rejects_bad_input(self):
        with self.assertRaises(ValidationError):
            sanitize({"timestamp": NOW.isoformat()}, now=NOW)
        with self.assertRaises(ValidationError):
            sanitize({"device_id": "d", "timestamp": "yesterday"}, now=NOW)
        with self.assertRaises(ValidationError):
            sanitize({"device_id": "d", "timestamp": (NOW + timedelta(hours=1)).isoformat()}, now=NOW)

    def test_nan_and_bool_are_not_numbers(self):
        r = rec(tds_ppm=float("nan"))
        self.assertIsNone(r["tds_ppm"])
        r = rec(flow_lpm=True)
        self.assertIsNone(r["flow_lpm"])


class Diagnostics(unittest.TestCase):
    cfg = Thresholds()

    def keys(self, recent, now_s):
        now_ms = int((NOW + timedelta(seconds=now_s)).timestamp() * 1000)
        return {a["key"]: a for a in diagnostics.evaluate(recent, now_ms, self.cfg)}

    def test_no_data(self):
        k = self.keys([], 0)
        self.assertIn("no-live-data", k)
        self.assertEqual(k["turbidity-absent"]["severity"], "info")

    def test_healthy_has_only_turbidity_info(self):
        recent = [rec(i) for i in range(0, 30)]
        self.assertEqual(set(self.keys(recent, 30)), {"turbidity-absent"})

    def test_stale_then_offline(self):
        recent = [rec(0)]
        self.assertEqual(self.keys(recent, 20)["stale"]["severity"], "warning")
        self.assertEqual(self.keys(recent, 70)["stale"]["severity"], "critical")

    def test_stale_pauses_pump_rules(self):
        recent = [rec(i, flow_lpm=0.0) for i in range(30)]
        self.assertNotIn("pump-no-flow", self.keys(recent, 29 + 20))

    def test_pump_on_no_flow_after_startup_delay_is_only_possible(self):
        recent = [rec(i, flow_lpm=0.0) for i in range(0, 25)]
        a = self.keys(recent, 25)["pump-no-flow"]
        self.assertEqual(a["basis"], "possible")

    def test_no_flow_inside_startup_delay_is_ignored(self):
        recent = [rec(i, flow_lpm=0.0) for i in range(0, 5)]
        self.assertNotIn("pump-no-flow", self.keys(recent, 5))

    def test_flow_with_pump_off(self):
        recent = [rec(i, pump_commanded=False, pump_state="off", flow_lpm=0.7) for i in range(5)]
        self.assertIn("flow-pump-off", self.keys(recent, 5))

    def test_invalid_sensor_is_reported_without_zero(self):
        recent = [rec(0, sensor_status={"tds": "disconnected", "temperature": "valid", "flow": "valid"})]
        self.assertIn("sensor-tds", self.keys(recent, 1))

    def test_pump_fault_is_critical(self):
        recent = [rec(0, pump_state="fault")]
        self.assertEqual(self.keys(recent, 1)["pump-fault"]["severity"], "critical")

    def test_tds_threshold_alert_says_it_is_not_a_safety_verdict(self):
        recent = [rec(0, tds_ppm=620)]
        a = self.keys(recent, 1)["tds-high"]
        self.assertTrue(any("not a drinking-water judgement" in c for c in a["checks"]))

    def test_low_tds_never_produces_a_safe_verdict(self):
        recent = [rec(0, tds_ppm=20)]
        text = str(self.keys(recent, 1)).lower()
        self.assertNotIn("safe to drink", text)


class StoreTests(unittest.TestCase):
    def test_roundtrip_and_ordering(self):
        s = Store(":memory:")
        for i in (3, 1, 2):
            self.assertTrue(s.insert_reading(rec(i)))
        self.assertFalse(s.insert_reading(rec(1)))  # duplicate device+timestamp
        self.assertEqual(s.latest("filtravyn-001")["timestamp"], rec(3)["timestamp"])
        rows = s.range("filtravyn-001", 0, 10**14)
        self.assertEqual([r["timestamp"] for r in rows], [rec(i)["timestamp"] for i in (1, 2, 3)])
        self.assertIsNone(rows[0]["turbidity_ntu"])
        self.assertEqual(rows[0]["sensor_status"]["turbidity"], "not_installed")

    def test_nulls_are_preserved(self):
        s = Store(":memory:")
        s.insert_reading(rec(0, tds_ppm=9999))
        self.assertIsNone(s.latest("filtravyn-001")["tds_ppm"])

    def test_range_limit_keeps_newest(self):
        s = Store(":memory:")
        for i in range(10):
            s.insert_reading(rec(i))
        rows = s.range("filtravyn-001", 0, 10**14, limit=3)
        self.assertEqual([r["timestamp"] for r in rows], [rec(i)["timestamp"] for i in (7, 8, 9)])

    def test_command_lifecycle_and_double_ack(self):
        s = Store(":memory:")
        c = s.create_command("d", "pump", "on")
        self.assertEqual(c["status"], "pending")
        self.assertEqual(s.next_pending("d")["id"], c["id"])
        done = s.resolve_command(c["id"], True, None)
        self.assertEqual(done["status"], "acknowledged")
        self.assertIsNone(s.resolve_command(c["id"], False, "late"))  # cannot change an answered command
        self.assertIsNone(s.next_pending("d"))


if __name__ == "__main__":
    unittest.main()
