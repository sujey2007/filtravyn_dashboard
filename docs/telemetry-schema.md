# Telemetry schema

One record per sample. Field names and units are identical in the frontend (`frontend/src/types/telemetry.ts`), the backend, the API and the CSV export.

```json
{
  "device_id": "filtravyn-001",
  "timestamp": "2026-11-01T10:15:00.000Z",
  "mode": "live",
  "tds_ppm": 245,
  "temperature_c": 29.4,
  "flow_lpm": 1.2,
  "turbidity_ntu": null,
  "pump_commanded": true,
  "pump_state": "on",
  "sensor_status": { "tds": "valid", "temperature": "valid", "flow": "valid", "turbidity": "not_installed" }
}
```

| Field | Unit / type | Notes |
| --- | --- | --- |
| `device_id` | string, 1 to 64 chars | Required. |
| `timestamp` | ISO 8601, UTC | Device time. If missing, the backend uses receive time and marks the record internally. Rejected when more than 5 minutes in the future. |
| `mode` | `simulation` or `live` | Records from the device are always stored as `live`. |
| `tds_ppm` | ppm | `null` when unavailable. Placeholder range 0 to 1000. |
| `temperature_c` | °C | `null` when unavailable. Placeholder range -10 to 85. |
| `flow_lpm` | L/min | `null` when unavailable. Placeholder range 0 to 6. |
| `turbidity_ntu` | NTU | Always `null` until a sensor is installed. |
| `pump_commanded` | boolean | What the controller is commanding. |
| `pump_state` | `on`, `off`, `fault`, `unknown` | What the device reports. |
| `sensor_status.*` | `valid`, `disconnected`, `out_of_range`, `not_installed`, `unknown` | A sensor that is not `valid` carries no number. |

## Rules

1. `null` means unavailable. Zero is never a substitute.
2. A `valid` sensor with a value outside its range is stored as `null` with status `out_of_range`.
3. A sensor reporting any status other than `valid` has its value forced to `null`.
4. A value sent without any status is treated as `valid` and range-checked. A missing value is `unknown`.
5. Provenance: values from the device are **measured**. Total volume is **calculated** from valid flow. Generated values are **simulated**. Nothing is currently **estimated**.

## CSV columns

```
device_id,timestamp,mode,tds_ppm,temperature_c,flow_lpm,turbidity_ntu,pump_commanded,pump_state,tds_status,temperature_status,flow_status,turbidity_status
```

Blank cell = unavailable.

## MQTT

Topic `filtravyn/<device_id>/telemetry`, JSON payload as above. `device_id` may be omitted and is then taken from the topic. The bridge applies the same validation as `POST /api/telemetry`.
