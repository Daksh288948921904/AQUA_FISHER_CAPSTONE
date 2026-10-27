from typing import Optional
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from app.analyser import analyze_water_quality
from app.models import SensorReading, AnalyseRequest
from app.source import fetch_from_source
from app import store

app=FastAPI(
    title="Aqua Shark Dashboard",
    version="0.2.0",
    description="Water analysis",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/health")
async def health():
    return {"status":"ok","service":"aqua shark"}

# The data-fetching application pushes readings here (one reading or a list).
@app.post("/api/v1/readings", status_code=201)
async def ingest_readings(payload: SensorReading | list[SensorReading]):
    readings = payload if isinstance(payload, list) else [payload]
    total = store.add_readings(readings)
    return {"accepted": len(readings), "total_stored": total}

# The CMS polls this to display the latest readings.
@app.get("/api/v1/readings")
async def list_readings(limit: Optional[int] = Query(None, ge=1)):
    readings = store.get_readings(limit)
    return {"count": len(readings), "readings": [r.model_dump(mode="json") for r in readings]}

# The CMS "Fetch Data" button: pull readings from the data-fetching system into the store.
@app.post("/api/v1/readings/fetch")
async def fetch_readings():
    try:
        readings, skipped = await fetch_from_source()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not fetch from data source: {str(e)}")
    total = store.add_readings(readings)
    return {"fetched": len(readings), "skipped": skipped, "total_stored": total}

@app.delete("/api/v1/readings")
async def clear_readings():
    store.clear_readings()
    return {"cleared": True}

@app.post("/api/v1/analyse")
async def analyze(request: Optional[AnalyseRequest] = None):
    request = request or AnalyseRequest()
    readings = request.readings or store.get_readings()
    if not readings:
        raise HTTPException(status_code=422, detail="No sensor readings available to analyse.")
    try:
        result = await analyze_water_quality(readings, request.location_name)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


if __name__=="__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
