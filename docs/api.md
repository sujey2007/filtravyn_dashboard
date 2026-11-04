# API

Base path `/api`. JSON only. Interactive docs are at `/docs` when the backend is running.

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | none | Backend health. |
| GET | `/api/device?device_id=` | none | Identity and connection: `online`, `stale`, `offline`, `unknown`. Includes `pump_control_enabled`. |
| POST | `/api/telemetry` | `X-Device-Key` | Ingest one record. 201 on success, 409 on duplicate device and timestamp, 422 on invalid input, 503 if `DEVICE_API_KEY` is unset. |
| GET | `/api/readings/latest` | none | Latest record, or 404 when nothing has been received. |
| GET | `/api/readings?from=&to=&limit=` | none | History, oldest first. `from` and `to` are ISO 8601. `limit` up to 20000. When more rows match, the newest `limit` rows are returned. |
| GET | `/api/alerts` | none | Current rule-based alerts. `since` is `null` because the backend is stateless. The dashboard tracks first-seen time itself. |
| GET | `/api/model/config` | none | Model asset and component mapping, read from `frontend/public/models/model.config.json`. |
| POST | `/api/device/pump` | `X-API-Key` | Request a pump change. Returns 202 and a `pending` command. |
| GET | `/api/device/pump/{id}` | none | Command status: `pending`, `acknowledged`, `failed`. |
| GET | `/api/device/commands/pending` | `X-Device-Key` | Device polls for its next pending command. |
| POST | `/api/device/commands/{id}/ack` | `X-Device-Key` | Device reports `{ "ok": true }` or `{ "ok": false, "detail": "..." }`. |
| WS | `/ws/telemetry` | none | Pushes each new record as JSON. |

## Pump control

Disabled by default (`PUMP_CONTROL_ENABLED=0`), so the dashboard stays read-only.

When enabled:

- The request needs `X-API-Key` equal to `ADMIN_API_KEY`.
- The backend refuses unless the device is `online`, refuses while a command is pending, and enforces `PUMP_MIN_COMMAND_INTERVAL_S` between commands.
- The command stays `pending` until the ESP32 polls `/api/device/commands/pending` and then posts an acknowledgement. Nothing is shown as changed before that.
- The browser never holds the admin key. Wire the control button through a server you trust before exposing it. The current frontend has no pump button on purpose.

## Hardware safety is not enforced here

The backend cannot make a 24 V pump safe. Current limits, dry-run protection and relay rating belong in the firmware and wiring.

## Auth and secrets

- Keys are compared in constant time and have no default value.
- No key is ever put in `VITE_*` variables or frontend code.
- Add TLS and a reverse proxy before any use outside a local network.
