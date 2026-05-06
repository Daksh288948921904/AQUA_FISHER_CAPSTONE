# Aqua Sentinel 🛸💧

**Drone-based water quality analysis powered by LLM intelligence.**

A FastAPI backend that ingests sensor data PDFs from drone water-quality surveys and returns comprehensive, geographically-aware analysis using OpenAI's GPT-4o.

## Architecture

```
Drone Sortie → Sensor PDF → FastAPI → PDF Text Extraction → OpenAI GPT-4o → Structured JSON Analysis
```

### Sensors Supported
| Sensor | Unit | Method |
|--------|------|--------|
| pH | — | ISE glass electrode |
| Turbidity | NTU | Nephelometric IR |
| Dissolved Oxygen | mg/L | Optical luminescence |
| Temperature | °C | Pt1000 RTD |
| Conductivity | µS/cm | 4-electrode cell |
| Ammonia (NH₃-N) | mg/L | Ion-selective electrode |
| ORP | mV | Pt/Ag-AgCl redox |
| GPS | WGS84 | u-blox GNSS |

## Quick Start

### 1. Install Dependencies
```bash
cd aqua-sentinel
pip install -r requirements.txt
```

### 2. Set Your OpenAI Key
```bash
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Or export directly:
export OPENAI_API_KEY="sk-your-key-here"
```

### 3. Generate Synthetic Data (already included)
```bash
python scripts/generate_synthetic_data.py
# Creates: data/dal_lake_survey_2026-05-05.pdf
```

### 4. Run the Server
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 5. Test the API

**Demo endpoint** (uses bundled synthetic data — no upload needed):
```bash
curl -X POST http://localhost:8000/api/v1/analyse-demo | python -m json.tool
```

**Upload your own PDF**:
```bash
curl -X POST http://localhost:8000/api/v1/analyse \
  -F "file=@data/dal_lake_survey_2026-05-05.pdf" | python -m json.tool
```

**Health check**:
```bash
curl http://localhost:8000/health
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `POST` | `/api/v1/analyze` | Upload a PDF for analysis |
| `POST` | `/api/v1/analyze-demo` | Analyze bundled Dal Lake data |
| `GET` | `/docs` | Swagger UI (auto-generated) |

## Response Schema

The LLM returns a structured JSON report containing:

- **Overall Water Quality Index** (0-100 score with category)
- **Per-parameter analysis** with stats, compliance status, ecological interpretation
- **Geographic risk factors** specific to the water body's location
- **Ecological assessment** (trophic state, biodiversity impact, algal bloom risk)
- **Contamination analysis** (pollution sources, nutrient loading)
- **Regulatory compliance** against CPCB, BIS IS 10500, and WHO standards
- **Actionable recommendations** (immediate, monitoring, long-term)

## Project Structure

```
aqua-sentinel/
├── main.py                          # FastAPI app entry point
├── app/
│   ├── __init__.py
│   ├── config.py                    # Settings from env vars
│   ├── analyzer.py                  # OpenAI API call + system prompt
│   └── pdf_utils.py                 # PDF text extraction
├── scripts/
│   └── generate_synthetic_data.py   # Synthetic data PDF generator
├── data/
│   └── dal_lake_survey_2026-05-05.pdf  # Bundled test data
├── requirements.txt
├── .env.example
└── README.md
```

## Synthetic Data

The bundled PDF simulates a 25-sample drone sortie over **Dal Lake, Srinagar, J&K** with:
- Realistic sensor ranges tuned to published limnological data
- GPS drift simulating drone movement
- Sensor specs, regulatory benchmarks, and field notes
- Summary statistics

## Tech Stack

- **FastAPI** — async web framework
- **pdfplumber** — PDF text/table extraction
- **httpx** — async HTTP client for OpenAI
- **reportlab** — PDF generation for synthetic data
- **OpenAI GPT-4o** — analysis engine 