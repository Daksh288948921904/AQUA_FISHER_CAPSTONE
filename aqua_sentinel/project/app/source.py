import httpx
from pydantic import ValidationError
from app.config import settings
from app.models import SensorReading

# Accepted key spellings from the data-fetching system -> our field names
ALIASES = {
    "ph": ["ph", "pH", "PH", "ph_value"],
    "turbidity": ["turbidity", "Turbidity", "turbidity_ntu", "ntu"],
    "tds": ["tds", "TDS", "tds_ppm", "tds_mgl"],
    "temperature": ["temperature", "temp", "Temperature", "temp_c", "water_temp"],
    "latitude": ["latitude", "lat", "Latitude"],
    "longitude": ["longitude", "lon", "lng", "long", "Longitude"],
    "timestamp": ["timestamp", "time", "created_at", "datetime", "recorded_at"],
    "device_id": ["device_id", "deviceId", "device", "sensor_id"],
}


def _normalise(raw: dict) -> dict:
    # GPS may arrive nested, e.g. {"gps": {"lat": .., "lon": ..}}
    gps = raw.get("gps") or raw.get("GPS") or raw.get("location")
    if isinstance(gps, dict):
        raw = {**gps, **raw}
    out = {}
    for field, keys in ALIASES.items():
        for k in keys:
            if raw.get(k) is not None:
                out[field] = raw[k]
                break
    return out


def _extract_list(payload) -> list:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("readings", "data", "results", "items", "records"):
            if isinstance(payload.get(key), list):
                return payload[key]
        return [payload]  # a single reading object
    raise ValueError("Unexpected response format from data source")


async def fetch_from_source() -> tuple[list[SensorReading], int]:
    """Pull readings from the data-fetching system. Returns (valid readings, number skipped)."""
    if not settings.source_api_url:
        raise ValueError("SOURCE_API_URL is not set. Add the data-fetching system's URL to .env.")
    headers = {"Authorization": f"Bearer {settings.source_api_key}"} if settings.source_api_key else {}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(settings.source_api_url, headers=headers)
    if response.status_code != 200:
        raise RuntimeError(f"Data source returned {response.status_code}: {response.text[:300]}")
    readings, skipped = [], 0
    for raw in _extract_list(response.json()):
        try:
            readings.append(SensorReading(**_normalise(raw)))
        except (ValidationError, TypeError):
            skipped += 1
    return readings, skipped
