"""Rule-based diagnostics. Mirrors frontend/src/services/diagnostics.ts.

No ML model is involved and nothing here claims one is. Every alert states its trigger and whether the
cause is confirmed (read straight from data) or only possible.
"""
from __future__ import annotations

from typing import Optional

from ..config import Thresholds

ORDER = {"critical": 0, "warning": 1, "info": 2}


def _alert(key, severity, title, detected, trigger, basis, checks):
    return {
        "key": key, "severity": severity, "title": title, "detected": detected,
        "trigger": trigger, "basis": basis, "checks": checks, "since": None,
    }


def turbidity_info():
    return _alert(
        "turbidity-absent", "info", "Turbidity sensor not installed",
        "Turbidity is unavailable. No NTU value is shown or estimated.",
        "sensor_status.turbidity = not_installed", "confirmed",
        ["Informational only. This is not a water-quality fault.",
         "Values appear once a sensor is installed and reporting valid data."],
    )


def pump_on_since_ms(recent: list[dict]) -> Optional[int]:
    since = None
    for r in reversed(recent):
        if not r["pump_commanded"]:
            break
        since = r["ts_ms"]
    return since


def _f(v, d=1):
    return "—" if v is None else f"{v:.{d}f}"


def evaluate(recent: list[dict], now_ms: int, cfg: Thresholds) -> list[dict]:
    """recent: normalized records, oldest first."""
    out: list[dict] = []
    if not recent:
        out.append(_alert(
            "no-live-data", "warning", "No live data",
            "The backend has no telemetry for this device yet.",
            "No telemetry received", "confirmed",
            ["Confirm the ESP32-S3 is powered and on Wi-Fi.",
             "Confirm the device sends to POST /api/telemetry or the MQTT topic with the correct key."],
        ))
        out.append(turbidity_info())
        return out

    last = recent[-1]
    age = (now_ms - last["ts_ms"]) / 1000
    if age > cfg.stale_timeout_s:
        offline = age > cfg.stale_timeout_s * 4
        out.append(_alert(
            "stale", "critical" if offline else "warning",
            "Device offline" if offline else "Telemetry stale",
            f"No new telemetry for {round(age)} s (timeout {cfg.stale_timeout_s:g} s).",
            f"Last message at {last['timestamp']}", "confirmed",
            ["Check ESP32-S3 power and Wi-Fi signal.", "Check the broker or backend is reachable.",
             "Pump and flow rules are paused because the last data may be outdated. The cause of the silence is not known."],
        ))
    else:
        names = {"tds": "TDS", "temperature": "Temperature", "flow": "Flow"}
        for k, nm in names.items():
            st = last["sensor_status"][k]
            if st != "valid":
                out.append(_alert(
                    f"sensor-{k}", "warning",
                    f"{nm} sensor {'disconnected' if st == 'disconnected' else 'reading invalid'}",
                    f'Sensor reports status "{st}". The value is shown as unavailable, not zero.',
                    f"sensor_status.{k}", "confirmed",
                    ["Check the sensor cable and connector.", "Check the sensor is in water where required.",
                     "Verify supply voltage at the sensor. The cause cannot be determined from software alone."],
                ))
        flow = last["flow_lpm"]
        flow_ok = last["sensor_status"]["flow"] == "valid" and flow is not None
        since = pump_on_since_ms(recent)
        on_for = 0 if since is None else (now_ms - since) / 1000
        if flow_ok and last["pump_commanded"] and on_for > cfg.startup_delay_s and flow < cfg.flow_min_lpm:
            out.append(_alert(
                "pump-no-flow", "warning", "Pump on, no flow detected",
                f"Pump commanded on for {round(on_for)} s but flow is {_f(flow, 2)} L/min.",
                f"pump_commanded = true and flow_lpm < {cfg.flow_min_lpm:g} after {cfg.startup_delay_s:g} s", "possible",
                ["Check tank level and pump prime.", "With power isolated, look for kinked tubing or a clogged cartridge.",
                 "Check flow sensor direction and cable.", "These are possible causes only. The rule cannot tell which one applies."],
            ))
        if flow_ok and not last["pump_commanded"] and flow >= cfg.flow_min_lpm:
            out.append(_alert(
                "flow-pump-off", "warning", "Flow while pump is off",
                f"Flow reads {_f(flow, 2)} L/min with the pump commanded off.",
                f"pump_commanded = false and flow_lpm >= {cfg.flow_min_lpm:g}", "possible",
                ["Check for siphoning or gravity flow through the water path.",
                 "Check the flow sensor for noise or a stuck pulse line.", "Check that the relay actually opens."],
            ))
        if last["pump_state"] == "fault":
            out.append(_alert(
                "pump-fault", "critical", "Pump reports a fault", "The device reports pump_state = fault.",
                "pump_state", "confirmed",
                ["Switch off and isolate 24 V power before inspecting.", "Check wiring and the relay output.",
                 "Check for a seized diaphragm or a blocked outlet."],
            ))
        tds = last["tds_ppm"]
        if tds is not None and tds > cfg.tds_warn_high:
            out.append(_alert(
                "tds-high", "warning", "TDS above project threshold",
                f"TDS reads {round(tds)} ppm, above the {cfg.tds_warn_high:g} ppm review threshold.", "tds_ppm", "confirmed",
                ["Rinse and re-seat the TDS probe, then read again.", "Compare with a handheld meter.",
                 "This prompts a review. It is not a drinking-water judgement, and the threshold is an uncalibrated placeholder."],
            ))
        t = last["temperature_c"]
        if t is not None and (t > cfg.temp_max or t < cfg.temp_min):
            out.append(_alert(
                "temp-range", "warning", "Temperature outside project range",
                f"Water temperature is {_f(t)} °C. Range is set to {cfg.temp_min:g} to {cfg.temp_max:g} °C.",
                "temperature_c", "confirmed",
                ["Check probe placement.", "Compare with a reference thermometer.",
                 "The range is a placeholder and not a safety limit."],
            ))
    out.append(turbidity_info())
    out.sort(key=lambda a: ORDER[a["severity"]])
    return out
