from collections import deque
from threading import Lock
from app.config import settings
from app.models import SensorReading

# In-memory buffer: readings are lost when the server restarts.
_readings: deque[SensorReading] = deque(maxlen=settings.max_stored_readings)
_lock = Lock()


def add_readings(readings: list[SensorReading]) -> int:
    with _lock:
        _readings.extend(readings)
        return len(_readings)


def get_readings(limit: int | None = None) -> list[SensorReading]:
    with _lock:
        items = list(_readings)
    return items[-limit:] if limit else items


def clear_readings() -> None:
    with _lock:
        _readings.clear()
