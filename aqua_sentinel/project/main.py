from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from app.analyser import analyze_water_quality
from app.models import SensorReading, AnalyseRequest
from app.source import fetch_from_source
from app import store
from app.config import settings

app=FastAPI(
    title="Aqua Shark Dashboard",
    version="0.2.0",
    description="Water analysis",
)
# Comma-separated list of allowed frontend origins, e.g. "https://aqua-sentinel.onrender.com"
cors_origins = [o.strip().rstrip("/") for o in settings.cors_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials="*" not in cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/health")
async def health():
    return {"status":"ok","service":"aqua Sentinel"}

# The data-fetching application pushes readings here (one reading or a list).
@app.post("/api/v1/readings", status_code=201)
async def ingest_readings(payload: SensorReading | list[SensorReading]):
    readings = payload if isinstance(payload, list) else [payload]
    batch = store.add_batch(readings, source="push")
    return {"accepted": len(readings), "batch_id": batch["id"]}

# All stored readings as one flat list.
@app.get("/api/v1/readings")
async def list_readings(limit: Optional[int] = Query(None, ge=1)):
    readings = store.get_readings(limit)
    return {"count": len(readings), "readings": [r.model_dump(mode="json") for r in readings]}

# The CMS shows each batch as its own block, newest first.
@app.get("/api/v1/batches")
async def list_batches():
    batches = [store.serialize_batch(b) for b in reversed(store.get_batches())]
    return {"count": len(batches), "batches": batches}

# The CMS "Fetch Data" button: pull readings from the data-fetching system as a new batch.
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

@app.post("/api/v1/analyse")
async def analyze(request: Optional[AnalyseRequest] = None):
    request = request or AnalyseRequest()
    if request.readings:
        readings = request.readings
    elif request.batch_id is not None:
        batch = next((b for b in store.get_batches() if b["id"] == request.batch_id), None)
        if not batch:
            raise HTTPException(status_code=404, detail=f"Batch {request.batch_id} not found.")
        readings = batch["readings"]
    else:
        readings = store.get_readings()
    if not readings:
        raise HTTPException(status_code=422, detail="No sensor readings available to analyse.")
    try:
        result = await analyze_water_quality(readings, request.location_name)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__=="__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
