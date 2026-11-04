# FiltraVyn Smart Water Purifier Dashboard

Monitoring and service console for the FiltraVyn purifier prototype (ESP32-S3, TDS, temperature, flow, 24 V diaphragm pump).

| Layer | Stack |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Three Fiber (Three.js), Recharts, React Router |
| Backend | Python FastAPI, SQLite (stdlib), WebSocket, optional MQTT bridge (paho-mqtt) |
| Theme | Light only |

## Run it

You need Node 20+ and Python 3.10+.

**Frontend** (works on its own in Simulation Mode, no backend needed):

```bash
cd frontend
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
npm run build        # type-checks, then builds to frontend/dist
```

**Backend** (needed for Live Device Mode and the Gemini assistant):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # set DEVICE_API_KEY to your own long random value; GEMINI_API_KEY is optional
uvicorn app.main:app --reload --port 8000
python -m unittest discover -s tests -v                # logic tests, no extra packages needed
```

The support chatbot also requires the backend, including when using Simulation Mode. Set `GEMINI_API_KEY` in `backend/.env`; get a key from [Google AI Studio](https://aistudio.google.com/apikey). The key stays on the backend and is never placed in the frontend bundle. `GEMINI_MODEL` defaults to `gemini-2.5-flash` and can be changed to a model available to your API key.

Vite proxies `/api` and `/ws` to `127.0.0.1:8000` in development, so run both and open the frontend URL.

Send a test record once the backend is up:

```bash
curl -X POST http://127.0.0.1:8000/api/telemetry \
  -H "Content-Type: application/json" -H "X-Device-Key: <your DEVICE_API_KEY>" \
  -d '{"device_id":"filtravyn-001","tds_ppm":242,"temperature_c":29.1,"flow_lpm":1.2,"pump_commanded":true,"pump_state":"on",
       "sensor_status":{"tds":"valid","temperature":"valid","flow":"valid"}}'
```

Then switch the console to **Live device**.

## Pages

1. **Overview** — 3D water path, TDS / temperature / flow / turbidity / pump / volume, active alerts, events, scenario bench.
2. **Digital twin** — orbit, pan, zoom, reset, auto-rotate, component selection, state legend, GLB loader and mesh mapping.
3. **Sensor analytics** — 1h / 24h / 7d / 30d charts, min / max / avg from valid records only, table, CSV download or copy.
4. **Alerts and diagnostics** — transparent rules with trigger, evidence, confirmed-or-possible label, editable placeholder thresholds.
5. **Support and DIY** — FAQ, guided troubleshooting, filter change with safety notes, sensor care, service log, and a Gemini-powered assistant for purifier questions. A floating chat button is also available on every page.

## Data rules that are enforced in code

- Simulation and Live data never mix. Switching modes clears the buffer. Live mode shows "No live data" and never falls back to generated values.
- Unavailable means `null`, and a blank CSV cell. Zero is never a substitute. The backend turns out-of-range values into `null` with status `out_of_range`.
- Turbidity is always `null` / `not_installed` until a sensor exists. The backend ignores any turbidity value sent.
- No "safe to drink" verdict from TDS. Filter remaining life is not estimated.
- Pump control is read-only in the UI. The backend endpoint is off by default, needs an admin key, refuses commands unless the device is online, and only ever reports `pending` until the device acknowledges.
- Thresholds, K-factor and ranges are placeholders in `frontend/src/config/device.ts` and `backend/.env`. No GPIO pins or calibration constants are hardcoded.

## Replace the placeholder with your SolidWorks model

See `docs/solidworks-model-integration.md`. Short version: export GLB with part names kept, copy to `frontend/public/models/`, set `asset` and `mapping` in `model.config.json`, or load a GLB from the Digital twin page to try it.

## Folder map

```
frontend/src/app          providers, layout, routes
frontend/src/pages        the five pages
frontend/src/features     digital-twin (React Three Fiber)
frontend/src/services     simulator, diagnostics, CSV, API client, component state
frontend/src/config       device settings and thresholds (placeholders)
frontend/public/models    model.config.json and your GLB
backend/app               FastAPI app, config, services (validation, diagnostics, store, MQTT)
backend/tests             logic tests
docs/                     schema, API, model integration
standalone-preview/       the single-file preview published earlier (not part of the stack)
```

## What has and has not been verified

Verified in the build environment: all 22 backend logic tests pass; the frontend diagnostics and simulator were compiled with strict TypeScript and run against every scenario; all 26 frontend source files parse with no syntax errors.

Not verified: `npm install`, `npm run build`, the FastAPI server itself, and a browser render of the React app. The build environment blocked the npm and PyPI registries. Expect to fix small type or version issues on the first `npm run build`. The React Three Fiber scene and Recharts pages are the likeliest places.

## Troubleshooting

- **Blank 3D area**: WebGL must be enabled. The rest of the page still works.
- **Live mode says "backend unreachable"**: start the backend and check that Vite is proxying `/api`.
- **401 from `/api/telemetry`**: the `X-Device-Key` header must equal `DEVICE_API_KEY`.
- **503 from `/api/telemetry`**: `DEVICE_API_KEY` is not set. Ingest stays disabled until it is.
- **503 from `/api/chat`**: set `GEMINI_API_KEY` in `backend/.env`, then restart the backend.
- **GLB loads but nothing is tinted**: names in the mapping must match mesh names exactly (shown on the Digital twin page).
