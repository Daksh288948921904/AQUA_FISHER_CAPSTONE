# Aqua Sentinel 🛸💧

**Drone-based water quality analysis powered by LLM intelligence.**

A FastAPI backend that receives live sensor readings from the drone data-fetching application and returns comprehensive, geographically-aware analysis using OpenAI's GPT-4o.

## Architecture

```
Drone sensors → Data-fetching app → POST /api/v1/readings → Reading store
                                                               │
                         CMS dashboard ← GET /api/v1/readings ─┤
                                                               │
            CMS "Analyze" → POST /api/v1/analyse → stats + readings → OpenAI GPT-4o → Structured JSON Analysis
```

### Sensors Supported
| Field | Sensor | Unit |
|-------|--------|------|
| `ph` | pH | — (0–14) |
| `turbidity` | Turbidity | NTU |
| `tds` | Total Dissolved Solids | mg/L (ppm) |
| `temperature` | Water temperature | °C |
| `latitude`, `longitude` | GPS | WGS84 |

## Quick Start

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Set Your OpenAI Key
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

### 3. Run the Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Push Readings (what the data-fetching app does)
A single reading or a list of readings. `timestamp` (ISO 8601, defaults to now, UTC assumed if no offset) and `device_id` are optional.
```bash
curl -X POST http://localhost:8000/api/v1/readings \
  -H "Content-Type: application/json" \
  -d '[{"timestamp":"2026-10-28T09:00:00Z","device_id":"drone-1","ph":7.6,"turbidity":14.2,"tds":330,"temperature":17.8,"latitude":34.0837,"longitude":74.86}]'
```

### 5. Analyse
Analyse everything currently stored:
```bash
curl -X POST http://localhost:8000/api/v1/analyse | python -m json.tool
```
Or send an explicit batch (and optional location name):
```bash
curl -X POST http://localhost:8000/api/v1/analyse \
  -H "Content-Type: application/json" \
  -d '{"location_name":"Dal Lake","readings":[{"ph":7.6,"turbidity":14.2,"tds":330,"temperature":17.8,"latitude":34.0837,"longitude":74.86}]}'
```

## Deploy to Render

The repo includes a [Render Blueprint](https://render.com/docs/blueprint-spec) (`render.yaml` at the repo root) that creates two services:

| Service | Type | Root dir |
|---------|------|----------|
| `aqua-sentinel-api` | Python web service (FastAPI) | `aqua_sentinel/project` |
| `aqua-sentinel` | Static site (React/Vite) | `aqua_sentinel/frontend` |

1. Push to GitHub, then in Render: **New → Blueprint** → pick this repo.
2. When prompted, fill in the secrets: `OPENAI_API_KEY`, `SOURCE_API_URL`, `SOURCE_API_KEY` (optional), and `VITE_API_URL` = the backend URL, e.g. `https://aqua-sentinel-api.onrender.com`.
3. After the first deploy, check the backend's actual URL in the dashboard. If it differs from what you entered for `VITE_API_URL`, update it on the static site and redeploy it (Vite bakes the URL in at build time).
4. Optional: set `CORS_ORIGINS` on the backend to the frontend URL (e.g. `https://aqua-sentinel.onrender.com`) instead of `*`.

Notes:
- Readings are kept in memory. On the free plan the backend sleeps after ~15 min idle and restarts lose stored readings; the first request after sleep takes ~30–60 s.
- Keep the backend to a single process (no `--workers`), since the in-memory store isn't shared between processes.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/api/v1/readings` | Ingest one reading or a list (data-fetching app) |
| `GET` | `/api/v1/batches` | List stored batches, newest first — one block per push/fetch (CMS) |
| `GET` | `/api/v1/readings?limit=N` | List all stored readings as one flat list |
| `DELETE` | `/api/v1/readings` | Clear stored readings (start a new survey) |
| `POST` | `/api/v1/analyse` | Run LLM analysis on given `readings`, a stored `batch_id`, or all stored readings |
| `GET` | `/docs` | Swagger UI (auto-generated) |

Each push or fetch is stored as one batch, held in memory (up to `MAX_STORED_BATCHES`, default 50) and lost on restart. The CMS shows each batch as a block, plus one simulated sample block, and generates a report per block.

## Response Schema

Per-parameter min/max/mean/std are computed server-side and passed to the LLM, which returns a structured JSON report containing:

- **Overall Water Quality Index** (0-100 score with category)
- **Per-parameter analysis** (pH, Turbidity, TDS, Temperature) with stats, compliance status, ecological interpretation
- **Geographic risk factors** specific to the water body's location (inferred from GPS)
- **Ecological assessment** (trophic state, biodiversity impact, algal bloom risk)
- **Contamination analysis** (pollution sources, nutrient loading)
- **Regulatory compliance** against CPCB, BIS IS 10500, and WHO standards
- **Actionable recommendations** (immediate, monitoring, long-term)

## Project Structure

```
project/
├── main.py              # FastAPI app + endpoints
├── app/
│   ├── config.py        # Settings from env vars
│   ├── models.py        # SensorReading / AnalyseRequest schemas
│   ├── store.py         # In-memory reading buffer
│   └── analyser.py      # Stats + OpenAI API call + system prompt
├── requirements.txt
├── .env.example
└── README.md
```

The CMS frontend (`../frontend`) polls `/api/v1/readings` and calls `/api/v1/analyse`. Set `VITE_API_URL` if the backend isn't at `http://localhost:8000`.

## Tech Stack

- **FastAPI** — async web framework
- **Pydantic** — reading validation
- **httpx** — async HTTP client for OpenAI
- **OpenAI GPT-4o** — analysis engine
