import asyncio
import math
import random
import time
from collections import deque
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set
from pydantic import BaseModel, Field

# ── Dal Lake Digital Twin Waypoints (Coordinates & Sectors) ──
DAL_LAKE_SECTORS = [
    {"name": "Gagribal Basin", "lat": 34.0784, "lon": 74.8482, "depth_m": 2.5},
    {"name": "Nehru Park Channel", "lat": 34.0855, "lon": 74.8510, "depth_m": 2.1},
    {"name": "Boulevard Houseboats", "lat": 34.0892, "lon": 74.8580, "depth_m": 3.0},
    {"name": "Bod Dal Center", "lat": 34.0980, "lon": 74.8670, "depth_m": 4.5},
    {"name": "Char Chinar Isle", "lat": 34.1082, "lon": 74.8625, "depth_m": 3.8},
    {"name": "Lokut Dal North", "lat": 34.1145, "lon": 74.8540, "depth_m": 3.2},
    {"name": "Hazratbal Inflow Bay", "lat": 34.1260, "lon": 74.8420, "depth_m": 4.0},
    {"name": "Nigeen Channel Link", "lat": 34.1160, "lon": 74.8320, "depth_m": 2.8},
    {"name": "Nigeen Lake West", "lat": 34.1090, "lon": 74.8290, "depth_m": 5.2},
    {"name": "Rainawari Navigational Outlet", "lat": 34.0920, "lon": 74.8390, "depth_m": 2.2},
]

# ── Input Pydantic Model (What Heltech WiFi sends: pH, Turbidity, TDS) ──
class SensorReadingInput(BaseModel):
    device_id: Optional[str] = "heltech-lora32-01"
    ph: Optional[float] = Field(default=None, ge=0, le=14, description="pH reading from sensor (0-14)")
    turbidity: Optional[float] = Field(default=None, ge=0, description="Turbidity reading from sensor in NTU")
    tds: Optional[float] = Field(default=None, ge=0, description="Total Dissolved Solids reading from sensor in ppm")
    conductivity: Optional[float] = Field(default=None, ge=0, description="Electrical conductivity in µS/cm (optional / derived from TDS)")
    temperature: Optional[float] = Field(default=None, description="Water temperature (mocked if omitted)")
    latitude: Optional[float] = Field(default=None, ge=-90, le=90, description="GPS Latitude (mocked if omitted)")
    longitude: Optional[float] = Field(default=None, ge=-180, le=180, description="GPS Longitude (mocked if omitted)")
    battery_pct: Optional[float] = Field(default=None, ge=0, le=100, description="Battery level %")
    rssi: Optional[int] = Field(default=None, description="Wi-Fi RSSI in dBm")
    notes: Optional[str] = None


# ── Full Enriched Telemetry Point ──
class EnrichedTelemetry(BaseModel):
    id: str
    timestamp: str
    device_id: str
    ph: float            # REAL SENSOR
    turbidity: float     # REAL SENSOR (NTU)
    tds: float           # REAL SENSOR (ppm)
    conductivity: float  # Derived from TDS (µS/cm)
    temperature: float   # MOCKED (°C)
    latitude: float      # MOCKED GPS
    longitude: float     # MOCKED GPS
    sector: str
    water_depth_m: float
    wqi_score: int
    wqi_category: str
    overall_status: str  # Normal | Caution | Critical
    alerts: List[str]
    parameter_statuses: Dict[str, str]
    battery_pct: Optional[float] = None
    rssi: Optional[int] = None
    sensor_origin: Dict[str, str] = Field(
        default_factory=lambda: {
            "ph": "hardware_sensor",
            "turbidity": "hardware_sensor",
            "tds": "hardware_sensor",
            "temperature": "mocked",
            "gps": "mocked",
        }
    )


# ── Telemetry Hub (State, Ring Buffer, SSE Dispatcher) ──
class TelemetryHub:
    def __init__(self, max_buffer_size: int = 3000):
        self.max_buffer_size = max_buffer_size
        self.buffer: deque[EnrichedTelemetry] = deque(maxlen=max_buffer_size)
        self.subscribers: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()

        # Flight path interpolation state for GPS mocking
        self._waypoint_idx = 0
        self._waypoint_progress = 0.0
        self._point_counter = 0

    def _next_mock_coordinates(self) -> tuple[float, float, str, float]:
        """Interpolates smoothly along Dal Lake sectors to create a realistic moving drone trace."""
        n = len(DAL_LAKE_SECTORS)
        wp_curr = DAL_LAKE_SECTORS[self._waypoint_idx % n]
        wp_next = DAL_LAKE_SECTORS[(self._waypoint_idx + 1) % n]

        # Step forward 8% along current leg per sensor reading
        self._waypoint_progress += 0.08
        if self._waypoint_progress >= 1.0:
            self._waypoint_progress = 0.0
            self._waypoint_idx = (self._waypoint_idx + 1) % n
            wp_curr = wp_next
            wp_next = DAL_LAKE_SECTORS[(self._waypoint_idx + 1) % n]

        # Linear interpolation + small GPS jitter
        t = self._waypoint_progress
        jitter_lat = (random.random() - 0.5) * 0.0003
        jitter_lon = (random.random() - 0.5) * 0.0003

        lat = wp_curr["lat"] + (wp_next["lat"] - wp_curr["lat"]) * t + jitter_lat
        lon = wp_curr["lon"] + (wp_next["lon"] - wp_curr["lon"]) * t + jitter_lon
        depth = round(wp_curr["depth_m"] + (wp_next["depth_m"] - wp_curr["depth_m"]) * t, 2)
        sector_name = wp_curr["name"] if t < 0.5 else wp_next["name"]

        return round(lat, 6), round(lon, 6), sector_name, depth

    def _evaluate_parameters(self, p: dict) -> tuple[Dict[str, str], List[str], int, str, str]:
        """Evaluates compliance for available sensors (pH, Turbidity, TDS) + Mocked Temperature."""
        statuses = {}
        alerts = []
        penalty = 0

        # 1. pH evaluation (CPCB Class B: 6.5–8.5)
        ph = p.get("ph", 7.5)
        if 6.8 <= ph <= 8.3:
            statuses["ph"] = "Normal"
        elif 6.5 <= ph <= 8.6:
            statuses["ph"] = "Caution"
            penalty += 12
            alerts.append(f"pH ({ph:.2f}) slightly outside optimal range")
        else:
            statuses["ph"] = "Critical"
            penalty += 26
            alerts.append(f"Critical pH anomaly ({ph:.2f})")

        # 2. Turbidity (NTU) (BIS IS 10500: <= 5 NTU drinking; <= 10 NTU acceptable lake)
        turb = p.get("turbidity", 8.0)
        if turb <= 10.0:
            statuses["turbidity"] = "Normal"
        elif turb <= 25.0:
            statuses["turbidity"] = "Caution"
            penalty += 14
            alerts.append(f"Elevated turbidity ({turb:.1f} NTU)")
        else:
            statuses["turbidity"] = "Critical"
            penalty += 28
            alerts.append(f"Severe suspended solids/turbidity ({turb:.1f} NTU)")

        # 3. Total Dissolved Solids (TDS in ppm) (CPCB / BIS standard: <= 300 ppm ideal, <= 500 ppm max)
        tds = p.get("tds", 200.0)
        if tds <= 250.0:
            statuses["tds"] = "Normal"
        elif tds <= 450.0:
            statuses["tds"] = "Caution"
            penalty += 12
            alerts.append(f"Elevated TDS ({tds:.0f} ppm)")
        else:
            statuses["tds"] = "Critical"
            penalty += 26
            alerts.append(f"High dissolved solids spike ({tds:.0f} ppm)")

        # 4. Temperature (°C) (Mocked: 10–22°C Himalayan cold-water range)
        temp = p.get("temperature", 17.5)
        if 12.0 <= temp <= 22.0:
            statuses["temperature"] = "Normal"
        elif 9.0 <= temp <= 26.0:
            statuses["temperature"] = "Caution"
            penalty += 6
        else:
            statuses["temperature"] = "Critical"
            penalty += 18
            alerts.append(f"Temperature anomaly ({temp:.1f} °C)")

        # 5. Conductivity (derived)
        cond = p.get("conductivity", 310.0)
        if cond <= 380.0:
            statuses["conductivity"] = "Normal"
        elif cond <= 550.0:
            statuses["conductivity"] = "Caution"
        else:
            statuses["conductivity"] = "Critical"

        # Overall WQI computation
        score = max(15, min(98, 100 - penalty))
        if score >= 80:
            category = "Excellent"
            overall_status = "Normal"
        elif score >= 65:
            category = "Good"
            overall_status = "Normal"
        elif score >= 50:
            category = "Moderate"
            overall_status = "Caution"
        elif score >= 35:
            category = "Poor"
            overall_status = "Critical"
        else:
            category = "Very Poor"
            overall_status = "Critical"

        if any(s == "Critical" for s in statuses.values()):
            overall_status = "Critical"

        return statuses, alerts, score, category, overall_status

    async def ingest_reading(self, raw: SensorReadingInput) -> EnrichedTelemetry:
        """Processes readings from Heltech WiFi board: accepts pH, Turbidity, TDS; mocks Temp & GPS."""
        async with self._lock:
            self._point_counter += 1
            now_iso = datetime.now(timezone.utc).isoformat()

            # Mock GPS coordinates along Dal Lake sectors
            if raw.latitude is not None and raw.longitude is not None:
                lat = round(raw.latitude, 6)
                lon = round(raw.longitude, 6)
                sector = "Dal Lake Sector"
                depth = 3.2
            else:
                lat, lon, sector, depth = self._next_mock_coordinates()

            # Mock Temperature: dynamic Dal Lake thermal model based on depth (deeper water is cooler)
            if raw.temperature is not None:
                mocked_temp = round(raw.temperature, 2)
            else:
                base_temp = 18.2 - (depth * 0.35) + (random.random() - 0.5) * 0.4
                mocked_temp = round(base_temp, 2)

            # TDS & Conductivity resolution:
            if raw.tds is not None:
                tds_val = round(raw.tds, 1)
                cond_val = round(raw.conductivity if raw.conductivity is not None else tds_val / 0.65, 1)
            elif raw.conductivity is not None:
                cond_val = round(raw.conductivity, 1)
                tds_val = round(cond_val * 0.65, 1)
            else:
                tds_val = round(210.0 + (random.random() - 0.5) * 22.0, 1)
                cond_val = round(tds_val / 0.65, 1)

            sensor_dict = {
                "ph": round(raw.ph if raw.ph is not None else 7.82 + (random.random() - 0.5) * 0.25, 2),
                "turbidity": round(raw.turbidity if raw.turbidity is not None else 14.2 + (random.random() - 0.5) * 3.2, 2),
                "tds": tds_val,
                "temperature": mocked_temp,
                "conductivity": cond_val,
            }

            statuses, alerts, wqi_score, wqi_cat, overall_status = self._evaluate_parameters(sensor_dict)

            enriched = EnrichedTelemetry(
                id=f"pt-{self._point_counter:05d}",
                timestamp=now_iso,
                device_id=raw.device_id or "heltech-lora32-01",
                ph=sensor_dict["ph"],
                turbidity=sensor_dict["turbidity"],
                tds=sensor_dict["tds"],
                conductivity=sensor_dict["conductivity"],
                temperature=sensor_dict["temperature"],
                latitude=lat,
                longitude=lon,
                sector=sector,
                water_depth_m=depth,
                wqi_score=wqi_score,
                wqi_category=wqi_cat,
                overall_status=overall_status,
                alerts=alerts,
                parameter_statuses=statuses,
                battery_pct=raw.battery_pct if raw.battery_pct is not None else 96.0,
                rssi=raw.rssi if raw.rssi is not None else -62,
            )

            self.buffer.append(enriched)

        await self._broadcast(enriched)
        return enriched

    async def _broadcast(self, item: EnrichedTelemetry):
        """Pushes new telemetry point to all active SSE subscribers."""
        dead_subscribers = []
        for q in list(self.subscribers):
            try:
                q.put_nowait(item)
            except asyncio.QueueFull:
                try:
                    q.get_nowait()
                    q.put_nowait(item)
                except Exception:
                    dead_subscribers.append(q)
            except Exception:
                dead_subscribers.append(q)

        for dead in dead_subscribers:
            self.subscribers.discard(dead)

    async def register_subscriber(self) -> asyncio.Queue:
        q = asyncio.Queue(maxsize=100)
        self.subscribers.add(q)
        return q

    def remove_subscriber(self, q: asyncio.Queue):
        self.subscribers.discard(q)

    def get_snapshot(self, limit: int = 100, window_minutes: int = 60) -> dict:
        """Computes time-series statistics for available sensors."""
        now = datetime.now(timezone.utc)
        cutoff_seconds = window_minutes * 60

        filtered = []
        for pt in reversed(self.buffer):
            try:
                pt_time = datetime.fromisoformat(pt.timestamp)
                diff = (now - pt_time).total_seconds()
                if diff <= cutoff_seconds:
                    filtered.append(pt)
                else:
                    break
            except Exception:
                filtered.append(pt)
            if len(filtered) >= limit:
                break

        if not filtered and self.buffer:
            filtered = list(reversed(list(self.buffer)))[:limit]

        chronological = list(reversed(filtered))

        def calc_stats(values: List[float]):
            if not values:
                return {"min": 0.0, "max": 0.0, "mean": 0.0, "std_dev": 0.0}
            mean_val = sum(values) / len(values)
            variance = sum((x - mean_val) ** 2 for x in values) / len(values)
            return {
                "min": round(min(values), 2),
                "max": round(max(values), 2),
                "mean": round(mean_val, 2),
                "std_dev": round(math.sqrt(variance), 2),
            }

        params = ["ph", "turbidity", "tds", "temperature", "conductivity"]
        stats = {
            p: calc_stats([getattr(pt, p) for pt in chronological if hasattr(pt, p)])
            for p in params
        }

        avg_wqi = round(sum(pt.wqi_score for pt in chronological) / len(chronological)) if chronological else 75
        latest = chronological[-1].model_dump() if chronological else None

        normal_cnt = sum(1 for pt in chronological if pt.overall_status == "Normal")
        caution_cnt = sum(1 for pt in chronological if pt.overall_status == "Caution")
        critical_cnt = sum(1 for pt in chronological if pt.overall_status == "Critical")

        return {
            "metadata": {
                "waterbody": "Dal Lake, Srinagar, J&K",
                "center_coordinates": {"latitude": 34.0837, "longitude": 74.8600},
                "elevation_m": 1583,
                "window_minutes": window_minutes,
                "total_readings": len(chronological),
                "start_time": chronological[0].timestamp if chronological else None,
                "end_time": chronological[-1].timestamp if chronological else None,
                "generated_at": now.isoformat(),
                "sensor_architecture": {
                    "physical_sensors": ["pH", "Turbidity", "TDS"],
                    "simulated_mocked": ["Temperature", "GPS Coordinates"],
                },
            },
            "crm_summary": {
                "average_wqi": avg_wqi,
                "compliance_category": "Good" if avg_wqi >= 70 else "Moderate" if avg_wqi >= 50 else "Poor",
                "status_breakdown": {
                    "normal_points": normal_cnt,
                    "caution_points": caution_cnt,
                    "critical_points": critical_cnt,
                },
                "primary_risk": "Elevated turbidity and TDS in peripheral lake channels" if stats["turbidity"]["max"] > 20 else "Nominal",
            },
            "statistics": stats,
            "latest_reading": latest,
            "readings": [pt.model_dump() for pt in chronological],
        }

    def format_survey_text_for_llm(self, limit: int = 50) -> str:
        """Formats the current live snapshot into structured survey text ready for GPT-4o analysis."""
        snap = self.get_snapshot(limit=limit, window_minutes=120)
        readings = snap.get("readings", [])
        if not readings:
            return "No sensor readings recorded yet."

        stats = snap.get("statistics", {})
        meta = snap.get("metadata", {})

        lines = [
            "================================================================================",
            "AQUA SENTINEL - REAL-TIME DRONE TELEMETRY LOG (LIVE STREAM SNAPSHOT)",
            "================================================================================",
            f"Location: {meta.get('waterbody')} | Elevation: {meta.get('elevation_m')}m ASL",
            f"Survey Window: {meta.get('start_time')} to {meta.get('end_time')}",
            f"Total High-Resolution Samples: {len(readings)}",
            "Hardware Sensors: pH, Nephelometric Turbidity, Total Dissolved Solids (TDS)",
            "Simulated Telemetry: Water Temperature, GPS u-blox Navigation",
            "",
            "PARAMETER SUMMARY STATISTICS:",
            f"- pH: Min={stats['ph']['min']}, Max={stats['ph']['max']}, Mean={stats['ph']['mean']}, StdDev={stats['ph']['std_dev']}",
            f"- Turbidity (NTU): Min={stats['turbidity']['min']}, Max={stats['turbidity']['max']}, Mean={stats['turbidity']['mean']}, StdDev={stats['turbidity']['std_dev']}",
            f"- TDS (ppm): Min={stats['tds']['min']}, Max={stats['tds']['max']}, Mean={stats['tds']['mean']}, StdDev={stats['tds']['std_dev']}",
            f"- Water Temperature (°C, Mocked): Min={stats['temperature']['min']}, Max={stats['temperature']['max']}, Mean={stats['temperature']['mean']}",
            f"- Conductivity (µS/cm, Derived): Min={stats['conductivity']['min']}, Max={stats['conductivity']['max']}, Mean={stats['conductivity']['mean']}",
            "",
            "DETAILED SPATIAL WAYPOINT MEASUREMENTS:",
            "Sample | Timestamp | Latitude | Longitude | Sector | pH | Turb(NTU) | TDS(ppm) | Temp(°C) | Status",
            "-------------------------------------------------------------------------------------------------------",
        ]

        for r in readings[-35:]:
            lines.append(
                f"{r['id']} | {r['timestamp']} | {r['latitude']} | {r['longitude']} | {r['sector']} | "
                f"{r['ph']} | {r['turbidity']} | {r['tds']} | {r['temperature']} | {r['overall_status']}"
            )

        lines.append("================================================================================")
        return "\n".join(lines)


# Singleton instance
telemetry_hub = TelemetryHub()
