import asyncio
import json
import logging
import os
import random
import tempfile
from contextlib import asynccontextmanager
from typing import Optional

import uvicorn
from fastapi import FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.analyser import analyze_water_quality
from app.config import settings
from app.models import AnalyseRequest, SensorReading
from app.pdf_utils import extract_text_from_pdf
from app.source import fetch_from_source
from app import store
from app.telemetry import (
    EnrichedTelemetry,
    SensorReadingInput,
    telemetry_hub,
)

logger = logging.getLogger("aqua_sentinel")
logging.basicConfig(level=logging.INFO)

# ── Background Mock Generator State ──
_mock_task: Optional[asyncio.Task] = None
_mock_running = False


async def _run_mock_generator():
    """Simulates real-time telemetry from Heltech WiFi LoRa 32 on Dal Lake every 2.5 seconds."""
    global _mock_running
    logger.info("Mock telemetry generator started.")
    try:
        while _mock_running:
            # Available physical sensors: pH, Turbidity, TDS (Temperature & GPS auto-mocked)
            raw = SensorReadingInput(
                device_id="heltech-lora32-dal-01",
                ph=round(random.gauss(7.82, 0.22), 2),
                turbidity=round(max(2.0, random.gauss(14.8, 3.5)), 2),
                tds=round(max(40.0, random.gauss(210.0, 24.0)), 1),
                battery_pct=round(max(10.0, 96.0 - random.random()), 1),
                rssi=random.randint(-72, -54),
            )
            await telemetry_hub.ingest_reading(raw)
            await asyncio.sleep(2.5)
    except asyncio.CancelledError:
        logger.info("Mock telemetry generator stopped.")
        raise
    except Exception as e:
        logger.error(f"Error in mock telemetry generator: {e}")
    finally:
        _mock_running = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Pre-seed 12 realistic telemetry points along Dal Lake on boot
    logger.info("Pre-seeding initial Dal Lake telemetry buffer (pH, Turbidity, TDS)...")
    for _ in range(12):
        await telemetry_hub.ingest_reading(
            SensorReadingInput(
                device_id="heltech-lora32-dal-01",
                ph=round(random.gauss(7.8, 0.2), 2),
                turbidity=round(max(2.0, random.gauss(14.0, 3.0)), 2),
                tds=round(max(50.0, random.gauss(205.0, 20.0)), 1),
                battery_pct=98.0,
                rssi=-62,
            )
        )
    yield
    global _mock_running, _mock_task
    if _mock_task and not _mock_task.done():
        _mock_running = False
        _mock_task.cancel()


app = FastAPI(
    title="Aqua Sentinel & Digital Twin Dashboard",
    version="0.2.0",
    description="Real-time water quality monitoring, Heltech WiFi LoRa 32 telemetry hub, batch store, and Dal Lake Digital Twin.",
    lifespan=lifespan,
)

cors_origins = [o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()]
if not cors_origins or "*" in cors_origins:
    cors_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True if "*" not in cors_origins else False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health & Public Config ──
@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "Aqua Sentinel & Digital Twin",
        "telemetry_buffer_size": len(telemetry_hub.buffer),
        "active_sse_subscribers": len(telemetry_hub.subscribers),
        "stored_batches_count": len(store.get_batches()),
        "mock_simulator_active": _mock_running,
        "carto_configured": bool(settings.carto_api_key),
    }


@app.get("/api/v1/config")
async def get_public_config():
    return {
        "carto_api_key": settings.carto_api_key,
    }


# ── Batch & Data Source Endpoints (CMS / Push / Pull) ──
@app.post("/api/v1/readings", status_code=201)
async def ingest_readings(payload: SensorReading | list[SensorReading]):
    readings = payload if isinstance(payload, list) else [payload]
    batch = store.add_batch(readings, source="push")
    return {"accepted": len(readings), "batch_id": batch["id"]}


@app.get("/api/v1/readings")
async def list_readings(limit: Optional[int] = Query(None, ge=1)):
    readings = store.get_readings(limit)
    return {"count": len(readings), "readings": [r.model_dump(mode="json") for r in readings]}


@app.get("/api/v1/batches")
async def list_batches():
    batches = [store.serialize_batch(b) for b in reversed(store.get_batches())]
    return {"count": len(batches), "batches": batches}


@app.post("/api/v1/readings/fetch")
async def fetch_readings():
    try:
        readings, skipped = await fetch_from_source()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch from data source: {str(e)}")
    if not readings:
        raise HTTPException(status_code=422, detail=f"Data source returned no valid readings ({skipped} skipped).")
    batch = store.add_batch(readings, source="fetch")
    return {"fetched": len(readings), "skipped": skipped, "batch": store.serialize_batch(batch)}


@app.delete("/api/v1/readings")
async def clear_readings():
    store.clear_readings()
    return {"cleared": True}


# ── Dual-Mode Analysis Endpoint (PDF Upload or JSON Batch) ──
@app.post("/api/v1/analyse")
async def analyze(
    request: Request,
    file: Optional[UploadFile] = File(None),
):
    content_type = request.headers.get("content-type", "")

    # 1. PDF File Upload (Multipart Form Data)
    if "multipart/form-data" in content_type:
        upload = file
        if not upload:
            form = await request.form()
            upload = form.get("file")
        if not upload or not hasattr(upload, "filename") or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted.")
        try:
            contents = await upload.read()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(contents)
                tmp.flush()
                tmp_path = tmp.name

                pdf_text = extract_text_from_pdf(tmp_path)
                if not pdf_text or len(pdf_text.strip()) < 50:
                    raise HTTPException(
                        status_code=422,
                        detail="Could not extract meaningful text from the PDF.",
                    )
                result = await analyze_water_quality(pdf_text)
                return JSONResponse(content=result)
        finally:
            if "tmp_path" in locals() and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    # 2. JSON Batch Analysis (application/json)
    try:
        body = await request.json() if (await request.body()) else {}
        req_obj = AnalyseRequest(**body)
    except Exception:
        req_obj = AnalyseRequest()

    if req_obj.readings:
        readings = req_obj.readings
    elif req_obj.batch_id is not None:
        batch = next((b for b in store.get_batches() if b["id"] == req_obj.batch_id), None)
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch {req_obj.batch_id} not found.")
        readings = batch["readings"]
    else:
        readings = store.get_readings()

    if not readings:
        raise HTTPException(status_code=422, detail="No sensor readings available to analyse.")

    try:
        result = await analyze_water_quality(readings, req_obj.location_name)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ── Real-Time Heltech WiFi LoRa 32 Telemetry Ingestion ──
@app.post("/api/v1/telemetry", response_model=EnrichedTelemetry)
async def ingest_telemetry(reading: SensorReadingInput):
    """
    Ingest a live sensor reading from Heltech WiFi LoRa 32 probe (pH, Turbidity, TDS).
    GPS coordinates and water temperature are realistically mocked for Dal Lake.
    """
    try:
        enriched = await telemetry_hub.ingest_reading(reading)
        return enriched
    except Exception as e:
        logger.error(f"Failed to ingest telemetry: {e}")
        raise HTTPException(status_code=500, detail=f"Telemetry ingestion failed: {str(e)}")


# ── Live Server-Sent Events (SSE) Stream ──
@app.get("/api/v1/telemetry/stream")
async def stream_telemetry(request: Request):
    """
    Real-time Server-Sent Events (SSE) stream for live dashboard and Digital Twin.
    """
    subscriber_queue = await telemetry_hub.register_subscriber()

    async def event_generator():
        try:
            initial_payload = {
                "type": "handshake",
                "message": "Connected to Aqua Sentinel Live Telemetry Stream",
                "total_buffered": len(telemetry_hub.buffer),
                "latest": (
                    telemetry_hub.buffer[-1].model_dump()
                    if telemetry_hub.buffer
                    else None
                ),
            }
            yield f"data: {json.dumps(initial_payload)}\n\n"

            while True:
                try:
                    item: EnrichedTelemetry = await asyncio.wait_for(
                        subscriber_queue.get(), timeout=15.0
                    )
                    yield f"data: {item.model_dump_json()}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        except (asyncio.CancelledError, GeneratorExit):
            pass
        finally:
            telemetry_hub.remove_subscriber(subscriber_queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Snapshot / Time-Series Endpoint (Consumed by CRM or Report Generator) ──
@app.get("/api/v1/telemetry/snapshot")
async def get_telemetry_snapshot(
    limit: int = Query(default=100, ge=1, le=1000, description="Max readings to return"),
    window_minutes: int = Query(default=60, ge=1, le=1440, description="Time window in minutes"),
):
    snapshot = telemetry_hub.get_snapshot(limit=limit, window_minutes=window_minutes)
    return JSONResponse(content=snapshot)


# ── Live AI Report Generation from Telemetry Buffer ──
@app.post("/api/v1/telemetry/analyze-live")
async def analyze_live_telemetry(
    limit: int = Query(default=35, ge=5, le=100, description="Number of recent readings to feed to AI"),
):
    survey_text = telemetry_hub.format_survey_text_for_llm(limit=limit)
    if "No sensor readings recorded yet" in survey_text:
        raise HTTPException(
            status_code=400,
            detail="Insufficient live readings to generate report. Send telemetry first.",
        )
    try:
        report = await analyze_water_quality(survey_text)
        return JSONResponse(content=report)
    except Exception as e:
        logger.error(f"Live analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Live analysis failed: {str(e)}")


# ── Mock Simulator Controls ──
@app.post("/api/v1/telemetry/mock/start")
async def start_mock_simulation():
    global _mock_task, _mock_running
    if _mock_running and _mock_task and not _mock_task.done():
        return {"status": "already_running", "message": "Simulation is already active."}
    _mock_running = True
    _mock_task = asyncio.create_task(_run_mock_generator())
    return {"status": "started", "message": "Heltech WiFi LoRa 32 mock simulator started (2.5s cadence)."}


@app.post("/api/v1/telemetry/mock/stop")
async def stop_mock_simulation():
    global _mock_task, _mock_running
    if not _mock_running:
        return {"status": "already_stopped", "message": "Simulation is not running."}
    _mock_running = False
    if _mock_task:
        _mock_task.cancel()
        _mock_task = None
    return {"status": "stopped", "message": "Heltech mock simulator stopped."}


@app.get("/api/v1/telemetry/mock/status")
async def get_mock_status():
    return {
        "running": _mock_running,
        "buffered_points": len(telemetry_hub.buffer),
        "connected_clients": len(telemetry_hub.subscribers),
    }


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
