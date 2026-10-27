from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class SensorReading(BaseModel):
    """One reading pushed by the data-fetching application."""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    device_id: Optional[str] = None
    ph: float = Field(..., ge=0, le=14)
    turbidity: float = Field(..., ge=0, description="NTU")
    tds: float = Field(..., ge=0, description="mg/L (ppm)")
    temperature: float = Field(..., description="°C")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)

    @field_validator("timestamp")
    @classmethod
    def assume_utc(cls, v: datetime) -> datetime:
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)


class AnalyseRequest(BaseModel):
    """Analyse the given readings, else the stored batch_id, else every stored reading."""
    location_name: Optional[str] = None
    readings: list[SensorReading] = []
    batch_id: Optional[int] = None
