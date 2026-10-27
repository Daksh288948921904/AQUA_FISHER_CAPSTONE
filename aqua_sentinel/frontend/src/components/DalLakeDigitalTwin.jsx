import { useState, useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Polyline,
  Marker,
  Popup,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  getCartoTileUrl,
  getCartoApiKey,
  setCartoApiKey,
  getApiBaseUrl,
} from "../utils/api";
import {
  ACCENT,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "../utils/constants";

// Static Dal Lake Geographic Sectors & Landmarks
const DAL_LAKE_LANDMARKS = [
  {
    name: "Char Chinar Island",
    coords: [34.1082, 74.8625],
    type: "landmark",
    desc: "Historic island with four Chinar trees in Bod Dal",
  },
  {
    name: "Hazratbal Inflow Bay",
    coords: [34.126, 74.842],
    type: "inflow",
    desc: "Northern inflow channel and urban catchment",
  },
  {
    name: "Nigeen Lake Basin",
    coords: [34.109, 74.829],
    type: "basin",
    desc: "Deep western basin connected via Nallah Amir Khan",
  },
  {
    name: "Gagribal Basin",
    coords: [34.0784, 74.8482],
    type: "basin",
    desc: "Southern tourist & boulevard sector",
  },
  {
    name: "Boulevard Houseboats",
    coords: [34.0892, 74.858],
    type: "pressure",
    desc: "High organic waste risk from floating accommodations",
  },
  {
    name: "Bod Dal Center",
    coords: [34.098, 74.867],
    type: "basin",
    desc: "Main open water body",
  },
];

// Custom Leaflet DivIcon for Drone / Probe
const createDroneIcon = (isCritical = false) => {
  const glowColor = isCritical ? "#FF1744" : "#00E5FF";
  return L.divIcon({
    className: "custom-drone-icon",
    html: `
      <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justifyContent: center;">
        <div style="position: absolute; inset: -4px; border-radius: 50%; background: ${glowColor}30; border: 1.5px solid ${glowColor}; animation: dronePulse 2s infinite ease-out;"></div>
        <div style="width: 28px; height: 28px; border-radius: 50%; background: #0A1628; border: 2px solid ${glowColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 16px ${glowColor}90;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${glowColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
          </svg>
        </div>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

const landmarkIcon = L.divIcon({
  className: "custom-landmark-icon",
  html: `
    <div style="background: rgba(10, 22, 40, 0.85); border: 1px solid rgba(0, 229, 255, 0.4); border-radius: 6px; padding: 2px 6px; font-size: 10px; color: #00E5FF; font-weight: 500; white-space: nowrap; box-shadow: 0 2px 8px rgba(0,0,0,0.6); backdrop-filter: blur(4px);">
      📍
    </div>
  `,
  iconSize: [24, 20],
  iconAnchor: [12, 10],
});

export default function DalLakeDigitalTwin({ readings = [], latest = null, cartoApiKey = null }) {
  const centerLat = latest?.latitude || 34.095;
  const centerLon = latest?.longitude || 74.855;
  const [backendCartoKey, setBackendCartoKey] = useState("");

  useEffect(() => {
    let active = true;
    if (!cartoApiKey && !getCartoApiKey()) {
      fetch(`${getApiBaseUrl()}/api/v1/config`)
        .then((r) => (r.ok ? r.json() : null))
        .then((cfg) => {
          if (cfg && cfg.carto_api_key && active) {
            setCartoApiKey(cfg.carto_api_key);
            setBackendCartoKey(cfg.carto_api_key);
          }
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [cartoApiKey]);

  const effectiveCartoKey = cartoApiKey || backendCartoKey || getCartoApiKey();
  const tileUrl = useMemo(() => getCartoTileUrl(effectiveCartoKey), [effectiveCartoKey]);

  // Build the flight trajectory line
  const trajectoryCoords = useMemo(() => {
    return readings.map((r) => [r.latitude, r.longitude]);
  }, [readings]);

  const isCritical = latest?.overall_status === "Critical";
  const droneIcon = useMemo(() => createDroneIcon(isCritical), [isCritical]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "540px",
        borderRadius: "16px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* ── Map Container ── */}
      <MapContainer
        center={[centerLat, centerLon]}
        zoom={13}
        style={{ width: "100%", height: "100%", background: "#081422" }}
        zoomControl={false}
      >
        <TileLayer
          key={tileUrl}
          url={tileUrl}
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />

        {/* ── Sector Landmark Markers ── */}
        {DAL_LAKE_LANDMARKS.map((lm, idx) => (
          <Marker key={idx} position={lm.coords} icon={landmarkIcon}>
            <Tooltip
              direction="top"
              offset={[0, -10]}
              opacity={0.9}
              permanent={false}
            >
              <div
                style={{
                  background: "#0A1628",
                  color: "#fff",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  fontSize: "11px",
                }}
              >
                <strong>{lm.name}</strong>
                <div style={{ fontSize: "10px", color: TEXT_SECONDARY }}>
                  {lm.desc}
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}

        {/* ── Flight Path Polyline ── */}
        {trajectoryCoords.length > 1 && (
          <Polyline
            positions={trajectoryCoords}
            pathOptions={{
              color: ACCENT,
              weight: 3,
              opacity: 0.7,
              dashArray: "6, 8",
            }}
          />
        )}

        {/* ── Historical Sample Points ── */}
        {readings.map((pt, i) => {
          const color =
            pt.overall_status === "Critical"
              ? "#FF1744"
              : pt.overall_status === "Caution"
                ? "#FFD600"
                : "#00E676";

          return (
            <CircleMarker
              key={pt.id || i}
              center={[pt.latitude, pt.longitude]}
              radius={i === readings.length - 1 ? 8 : 6}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.75,
                weight: 1.5,
              }}
            >
              <Popup>
                <div
                  style={{
                    background: "#0A1628",
                    color: "#fff",
                    margin: "-13px -20px",
                    padding: "16px",
                    border: `1px solid ${color}40`,
                    borderRadius: "12px",
                    boxShadow: "0 6px 24px rgba(0,0,0,0.6)",
                    width: "260px",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <strong style={{ fontSize: "13px", color: color }}>
                      {pt.sector || "Dal Lake Sample"}
                    </strong>
                    <span
                      style={{
                        fontSize: "11px",
                        background: `${color}20`,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        color,
                      }}
                    >
                      WQI {pt.wqi_score}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: TEXT_MUTED,
                      marginBottom: "8px",
                    }}
                  >
                    ID: {pt.id} &bull;{" "}
                    {new Date(pt.timestamp).toLocaleTimeString()}
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "6px",
                      fontSize: "11px",
                    }}
                  >
                    <div>
                      pH: <strong>{pt.ph}</strong>
                    </div>
                    <div>
                      Turb: <strong>{pt.turbidity} NTU</strong>
                    </div>
                    <div>
                      TDS: <strong>{pt.tds ? `${pt.tds} ppm` : "—"}</strong>
                    </div>
                    <div>
                      Temp: <strong>{pt.temperature}°C</strong>
                    </div>
                    <div style={{ gridColumn: "span 2", fontSize: "10px", color: TEXT_MUTED }}>
                      Sensors: pH, Turb, TDS &bull; Mocked: Temp, GPS
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* ── Active Drone Position Marker ── */}
        {latest && (
          <Marker
            position={[latest.latitude, latest.longitude]}
            icon={droneIcon}
            zIndexOffset={1000}
          >
            <Tooltip
              direction="bottom"
              offset={[0, 18]}
              permanent
              opacity={0.95}
            >
              <div
                style={{
                  background: "rgba(10, 22, 40, 0.95)",
                  color: ACCENT,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  border: `1px solid ${ACCENT}40`,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                }}
              >
                HELTECH PROBE ({latest.sector || "In-Flight"})
              </div>
            </Tooltip>
          </Marker>
        )}
      </MapContainer>

      {/* ── HUD Overlay: Telemetry Stats (Top Right) ── */}
      <div
        style={{
          position: "absolute",
          top: "16px",
          right: "16px",
          zIndex: 1000,
          background: "rgba(10, 22, 40, 0.85)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "12px",
          padding: "14px 18px",
          width: "250px",
          pointerEvents: "none",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: ACCENT,
              fontWeight: 600,
            }}
          >
            DAL LAKE DIGITAL TWIN
          </span>
          <span
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "4px",
              background: isCritical
                ? "rgba(255,23,68,0.2)"
                : "rgba(0,230,118,0.2)",
              color: isCritical ? "#FF6E6E" : "#00E676",
            }}
          >
            {latest?.overall_status || "ACTIVE"}
          </span>
        </div>

        <div style={{ fontSize: "12px", marginBottom: "6px" }}>
          <span style={{ color: TEXT_MUTED }}>Current Sector: </span>
          <span style={{ fontWeight: 500, color: TEXT_PRIMARY }}>
            {latest?.sector || "Bod Dal Center"}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            fontSize: "11px",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <div>
            <span style={{ color: TEXT_MUTED }}>Lat:</span>{" "}
            {latest?.latitude?.toFixed(4) || "34.0950"}°
          </div>
          <div>
            <span style={{ color: TEXT_MUTED }}>Lon:</span>{" "}
            {latest?.longitude?.toFixed(4) || "74.8550"}°
          </div>
          <div>
            <span style={{ color: TEXT_MUTED }}>Depth:</span>{" "}
            {latest?.water_depth_m || 3.4}m
          </div>
          <div>
            <span style={{ color: TEXT_MUTED }}>Elev:</span> 1,583m
          </div>
          <div>
            <span style={{ color: TEXT_MUTED }}>RSSI:</span>{" "}
            {latest?.rssi || -64} dBm
          </div>
          <div>
            <span style={{ color: TEXT_MUTED }}>Batt:</span>{" "}
            {latest?.battery_pct || 95}%
          </div>
        </div>
      </div>

      {/* ── HUD Legend (Bottom Left) ── */}
      <div
        style={{
          position: "absolute",
          bottom: "16px",
          left: "16px",
          zIndex: 1000,
          background: "rgba(10, 22, 40, 0.85)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "8px",
          padding: "8px 14px",
          display: "flex",
          gap: "14px",
          alignItems: "center",
          fontSize: "11px",
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#00E676",
            }}
          />
          <span>Normal (CPCB Class B)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#FFD600",
            }}
          />
          <span>Caution</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "#FF1744",
            }}
          />
          <span>Critical Alert</span>
        </div>
      </div>

      {/* ── CSS for pulsing drone animation ── */}
      <style>{`
        @keyframes dronePulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          50% { transform: scale(1.4); opacity: 0.2; }
          100% { transform: scale(0.85); opacity: 0.9; }
        }
        .leaflet-popup-content-wrapper {
          background: transparent !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
        .leaflet-popup-tip {
          background: #0A1628 !important;
        }
        .leaflet-container {
          background: #081422 !important;
        }
      `}</style>
    </div>
  );
}
