from collections import deque
from datetime import datetime, timezone
from itertools import count
from threading import Lock
from app.config import settings
from app.models import SensorReading

# In-memory store: readings are lost when the server restarts.
# Each push from the data-fetching app, or each "Fetch Data" pull, is kept as one batch
# so the CMS can show it as a separate block and generate a report per batch.
_batches: deque[dict] = deque(maxlen=settings.max_stored_batches)
_ids = count(1)
_lock = Lock()


def add_batch(readings: list[SensorReading], source: str) -> dict:
    batch = {
        "id": next(_ids),
        "source": source,
        "created_at": datetime.now(timezone.utc),
        "readings": list(readings),
    }
    with _lock:
        _batches.append(batch)
    return batch


def get_batches() -> list[dict]:
    with _lock:
        return list(_batches)


def get_readings(limit: int | None = None) -> list[SensorReading]:
    items = [r for b in get_batches() for r in b["readings"]]
    return items[-limit:] if limit else items


def clear_readings() -> None:
    with _lock:
        _batches.clear()


def serialize_batch(batch: dict) -> dict:
    return {
        "id": batch["id"],
        "source": batch["source"],
        "created_at": batch["created_at"].isoformat(),
        "count": len(batch["readings"]),
        "readings": [r.model_dump(mode="json") for r in batch["readings"]],
    }
