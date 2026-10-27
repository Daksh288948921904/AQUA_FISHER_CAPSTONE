import { useState, useEffect, useRef } from "react";
import GlassCard from "./GlassCard";
import ScoreRing from "./ScoreRing";
import StatusDot from "./StatusDot";
import DalLakeDigitalTwin from "./DalLakeDigitalTwin";
import {
  getApiBaseUrl,
  setApiBaseUrl,
  getCartoApiKey,
  setCartoApiKey,
} from "../utils/api";
import {
  ACCENT,
  ACCENT2,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "../utils/constants";

export default function LiveTelemetryView() {
  const [readings, setReadings] = useState([]);
  const [latest, setLatest] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [alertFeed, setAlertFeed] = useState([]);
  const [packetCount, setPacketCount] = useState(0);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [apiUrl, setApiUrlState] = useState(getApiBaseUrl());
  const [cartoKey, setCartoKeyState] = useState(getCartoApiKey());
  const [showEndpointModal, setShowEndpointModal] = useState(false);
  const [tempEndpoint, setTempEndpoint] = useState(apiUrl);
  const [tempCartoKey, setTempCartoKey] = useState(cartoKey);
  const eventSourceRef = useRef(null);

  // 1. Initial data fetch to show live readings immediately on load
  useEffect(() => {
    let active = true;
    const fetchInitialData = async () => {
      const baseUrl = getApiBaseUrl();
      try {
        const res = await fetch(`${baseUrl}/api/v1/telemetry/snapshot?limit=50&window_minutes=60`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.readings && data.readings.length > 0) {
            setReadings(data.readings);
            const last = data.latest_reading || data.readings[data.readings.length - 1];
            setLatest(last);
            setPacketCount(data.readings.length);
            setLastUpdate(new Date(last.timestamp || Date.now()).toLocaleTimeString());
          } else {
            // If fresh boot with no points, start mock stream to seed initial points
            fetch(`${baseUrl}/api/v1/telemetry/mock/start`, { method: "POST" })
              .then(() => {
                if (active) setSimRunning(true);
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        console.warn("Could not fetch initial snapshot from:", baseUrl, err);
      }

      // Check mock simulator status
      try {
        const statusRes = await fetch(`${baseUrl}/api/v1/telemetry/mock/status`);
        if (statusRes.ok && active) {
          const statusData = await statusRes.json();
          setSimRunning(Boolean(statusData.running));
        }
      } catch {
        // Ignore offline simulator check
      }
    };

    fetchInitialData();

    return () => {
      active = false;
    };
  }, [apiUrl]);

  // 2. Setup Server-Sent Events (SSE) connection
  useEffect(() => {
    const baseUrl = getApiBaseUrl();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `${baseUrl}/api/v1/telemetry/stream`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "handshake") {
            if (data.latest) {
              setLatest(data.latest);
              setLastUpdate(new Date(data.latest.timestamp || Date.now()).toLocaleTimeString());
            }
            return;
          }

          // New incoming sensor reading from Heltech probe
          setLatest(data);
          setPacketCount((c) => c + 1);
          setLastUpdate(new Date().toLocaleTimeString());

          setReadings((prev) => {
            const next = [...prev, data];
            return next.length > 80 ? next.slice(next.length - 80) : next;
          });

          // Add to real-time alerts feed if any
          if (data.alerts && data.alerts.length > 0) {
            setAlertFeed((prev) => [
              ...data.alerts.map((a) => ({
                id: Math.random().toString(),
                text: a,
                sector: data.sector,
                time: new Date().toLocaleTimeString(),
                status: data.overall_status,
              })),
              ...prev,
            ].slice(0, 10));
          }
        } catch (e) {
          console.error("SSE parse error:", e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [apiUrl]);

  // Toggle mock simulator
  const toggleSimulation = async () => {
    const baseUrl = getApiBaseUrl();
    try {
      const endpoint = simRunning
        ? `${baseUrl}/api/v1/telemetry/mock/stop`
        : `${baseUrl}/api/v1/telemetry/mock/start`;
      const res = await fetch(endpoint, { method: "POST" });
      if (res.ok) {
        setSimRunning(!simRunning);
      }
    } catch (err) {
      console.error("Simulator toggle error:", err);
    }
  };

  const handleSaveEndpoint = () => {
    setApiBaseUrl(tempEndpoint);
    setCartoApiKey(tempCartoKey);
    setApiUrlState(getApiBaseUrl());
    setCartoKeyState(getCartoApiKey());
    setShowEndpointModal(false);
  };

  // Sensor parameters configuration: pH, Turbidity, TDS (Hardware Sensors) + Temperature (Mocked) + Conductivity (Derived)
  const paramsConfig = [
    {
      key: "ph",
      label: "pH Level",
      unit: "pH",
      standard: "6.5–8.5 (CPCB Class B)",
      icon: "🧪",
      source: "SENSOR",
      sourceColor: "#00E676",
      min: 0,
      max: 14,
      optMin: 6.5,
      optMax: 8.5,
    },
    {
      key: "turbidity",
      label: "Turbidity",
      unit: "NTU",
      standard: "≤ 5.0 NTU (BIS 10500)",
      icon: "🌊",
      source: "SENSOR",
      sourceColor: "#00E676",
      min: 0,
      max: 50,
      optMin: 0,
      optMax: 10.0,
    },
    {
      key: "tds",
      label: "Total Dissolved Solids (TDS)",
      unit: "ppm",
      standard: "≤ 300 ppm (Freshwater)",
      icon: "💎",
      source: "SENSOR",
      sourceColor: "#00E676",
      min: 0,
      max: 600,
      optMin: 50,
      optMax: 250,
    },
    {
      key: "temperature",
      label: "Water Temperature",
      unit: "°C",
      standard: "10–22°C (Himalayan Limnology)",
      icon: "🌡️",
      source: "MOCKED",
      sourceColor: "#B388FF",
      min: 0,
      max: 35,
      optMin: 12.0,
      optMax: 22.0,
    },
    {
      key: "conductivity",
      label: "Conductivity (EC)",
      unit: "µS/cm",
      standard: "≤ 350 µS/cm (Typical)",
      icon: "⚡",
      source: "DERIVED",
      sourceColor: "#00E5FF",
      min: 50,
      max: 800,
      optMin: 100,
      optMax: 380,
    },
  ];

  return (
    <div style={{ maxWidth: 1280, margin: "0 auto", padding: "16px 24px 80px" }}>
      {/* ── Console Header & Live Telemetry Link ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 20,
          background: "rgba(10,22,40,0.65)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "14px 20px",
          backdropFilter: "blur(16px)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          {/* Live Link Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: isConnected ? "#00E676" : "#FF1744",
                boxShadow: `0 0 12px ${isConnected ? "#00E676" : "#FF1744"}`,
                animation: isConnected ? "blink 2s infinite" : "none",
              }}
            />
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                letterSpacing: 1.2,
                color: isConnected ? "#00E676" : "#FF6E6E",
              }}
            >
              {isConnected ? "TELEMETRY LINK: ACTIVE (SSE)" : "DISCONNECTED (RECONNECTING...)"}
            </span>
          </div>

          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>

          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            Packets Received: <strong style={{ color: ACCENT, fontFamily: "'JetBrains Mono', monospace" }}>{packetCount}</strong>
          </span>

          <span style={{ color: "rgba(255,255,255,0.2)" }}>|</span>

          <span style={{ fontSize: 12, color: TEXT_SECONDARY }}>
            Active Sector:{" "}
            <strong style={{ color: TEXT_PRIMARY }}>
              {latest?.sector || "Initializing Probe..."}
            </strong>
          </span>

          {lastUpdate && (
            <span style={{ fontSize: 11, color: TEXT_MUTED }}>
              ({lastUpdate})
            </span>
          )}
        </div>

        {/* Right Controls: Simulator Toggle & API Endpoint Button */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleSimulation}
            style={{
              background: simRunning ? "rgba(255,23,68,0.15)" : "rgba(0,229,255,0.12)",
              border: `1px solid ${simRunning ? "#FF174450" : `${ACCENT}40`}`,
              color: simRunning ? "#FF6E6E" : ACCENT,
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "all 0.2s",
            }}
          >
            <span>{simRunning ? "⏹ Stop Simulation" : "▶ Simulate Heltech Probe"}</span>
          </button>

          <button
            onClick={() => {
              setTempEndpoint(getApiBaseUrl());
              setTempCartoKey(getCartoApiKey());
              setShowEndpointModal(true);
            }}
            title="Configure online backend URL and map settings"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: TEXT_SECONDARY,
              padding: "7px 12px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>⚙️ Endpoint:</span>
            <span style={{ color: ACCENT, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {apiUrl.replace(/^https?:\/\//, "")}
            </span>
          </button>
        </div>
      </div>

      {/* ── Main Console View: Digital Twin Simulation + Live Probe Diagnostics ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 310px",
          gap: 20,
          marginBottom: 20,
        }}
      >
        {/* Left: Dal Lake Digital Twin Simulation Map */}
        <div>
          <DalLakeDigitalTwin readings={readings} latest={latest} cartoApiKey={cartoKey} />
        </div>

        {/* Right: Live Probe Diagnostics & WQI Gauge */}
        <GlassCard
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "22px 20px",
          }}
        >
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: ACCENT,
                  fontWeight: 600,
                }}
              >
                Water Quality Index
              </span>
              <span
                style={{
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background:
                    latest?.overall_status === "Critical"
                      ? "rgba(255,23,68,0.2)"
                      : "rgba(0,230,118,0.15)",
                  color:
                    latest?.overall_status === "Critical"
                      ? "#FF6E6E"
                      : "#00E676",
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}
              >
                {latest?.overall_status || "NORMAL"}
              </span>
            </div>

            {/* Live Score Ring */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                margin: "12px 0 16px",
              }}
            >
              <ScoreRing
                score={latest?.wqi_score || 78}
                size={144}
                label={latest?.wqi_category || "Good"}
              />
            </div>

            {/* Probe Telemetry Health Block */}
            <div
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 10,
                padding: "14px",
                fontSize: 12,
                lineHeight: 1.7,
                color: TEXT_SECONDARY,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: TEXT_MUTED }}>Probe Device:</span>
                <span style={{ color: TEXT_PRIMARY, fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
                  {latest?.device_id || "heltech-lora32-dal-01"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: TEXT_MUTED }}>Wi-Fi / LoRa RSSI:</span>
                <span style={{ color: ACCENT, fontFamily: "'JetBrains Mono', monospace" }}>
                  {latest?.rssi ? `${latest.rssi} dBm` : "-62 dBm"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: TEXT_MUTED }}>Battery Level:</span>
                <span style={{ color: "#00E676", fontFamily: "'JetBrains Mono', monospace" }}>
                  {latest?.battery_pct ? `${latest.battery_pct}%` : "98%"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ color: TEXT_MUTED }}>Water Depth:</span>
                <span style={{ color: TEXT_PRIMARY }}>
                  {latest?.water_depth_m ? `${latest.water_depth_m}m` : "3.2m"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: TEXT_MUTED }}>Survey Elevation:</span>
                <span style={{ color: TEXT_PRIMARY }}>1,583m ASL</span>
              </div>
            </div>
          </div>

          {/* Quick Status Note */}
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(0, 229, 255, 0.04)",
              border: `1px solid ${ACCENT}25`,
              fontSize: 11,
              color: TEXT_SECONDARY,
              lineHeight: 1.5,
            }}
          >
            <strong style={{ color: ACCENT }}>Autonomous Probe:</strong> Continuous streaming from Dal Lake. Coordinates tracked in Digital Twin.
          </div>
        </GlassCard>
      </div>

      {/* ── 7 Real-Time Sensor Telemetry Cards with Visual Mini-Gauges ── */}
      <div style={{ marginBottom: 20 }}>
        <p
          style={{
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            margin: "0 0 12px",
            fontWeight: 600,
          }}
        >
          Heltech WiFi LoRa 32 Sensor Telemetry
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 14,
          }}
        >
          {paramsConfig.map((p) => {
            const val = latest ? latest[p.key] : null;
            const status =
              latest?.parameter_statuses
                ? latest.parameter_statuses[p.key] || "Normal"
                : "Normal";
            const statusColor =
              status === "Critical"
                ? "#FF1744"
                : status === "Caution"
                ? "#FFD600"
                : "#00E676";

            // Calculate percentage position for gauge bar
            const numVal = typeof val === "number" ? val : (p.min + p.max) / 2;
            const pct = Math.min(100, Math.max(0, ((numVal - p.min) / (p.max - p.min)) * 100));

            return (
              <GlassCard key={p.key} style={{ padding: "16px 18px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{p.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: TEXT_PRIMARY }}>
                      {p.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span
                      style={{
                        fontSize: 9,
                        padding: "1px 5px",
                        borderRadius: 3,
                        background: `${p.sourceColor}18`,
                        color: p.sourceColor,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                      }}
                    >
                      {p.source}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: `${statusColor}18`,
                        color: statusColor,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                      }}
                    >
                      {status}
                    </span>
                  </div>
                </div>

                {/* Big Value Display */}
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "8px 0 10px" }}>
                  <span
                    style={{
                      fontSize: 26,
                      fontWeight: 300,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: TEXT_PRIMARY,
                    }}
                  >
                    {val !== null && val !== undefined ? val : "—"}
                  </span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>{p.unit}</span>
                </div>

                {/* Visual Gauge Bar */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: 5,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    overflow: "hidden",
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: statusColor,
                      borderRadius: 3,
                      transition: "width 0.4s ease-out, background 0.4s ease",
                      boxShadow: `0 0 8px ${statusColor}80`,
                    }}
                  />
                </div>

                <div style={{ fontSize: 10, color: TEXT_MUTED }}>
                  Limit: {p.standard}
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* ── Real-Time Limnological Event & Alerts Feed ── */}
      <div>
        <p
          style={{
            fontSize: 11,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: ACCENT,
            margin: "0 0 10px",
            fontWeight: 600,
          }}
        >
          Limnological Telemetry Stream Log
        </p>

        <GlassCard style={{ padding: "16px 20px" }}>
          {alertFeed.length === 0 ? (
            <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0, fontStyle: "italic" }}>
              🟢 Stream active. All parameters within safe limits across surveyed Dal Lake waypoints.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alertFeed.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    borderRadius: 8,
                    background:
                      alert.status === "Critical"
                        ? "rgba(255,23,68,0.08)"
                        : "rgba(255,214,0,0.08)",
                    borderLeft: `3px solid ${
                      alert.status === "Critical" ? "#FF1744" : "#FFD600"
                    }`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StatusDot status={alert.status} />
                    <span style={{ fontSize: 13, color: TEXT_PRIMARY }}>{alert.text}</span>
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: TEXT_MUTED }}>
                    <span>📍 {alert.sector}</span>
                    <span>{alert.time}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Endpoint Configuration Modal ── */}
      {showEndpointModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <GlassCard style={{ maxWidth: 460, width: "100%", padding: 28 }} glow={ACCENT}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 500 }}>
              Backend & Map Configuration
            </h3>
            <p style={{ color: TEXT_SECONDARY, fontSize: 13, margin: "0 0 16px", lineHeight: 1.5 }}>
              Configure your online backend connection and optional Carto map API key:
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6 }}>
                Backend API Endpoint
              </label>
              <input
                type="text"
                value={tempEndpoint}
                onChange={(e) => setTempEndpoint(e.target.value)}
                placeholder="http://localhost:8000 or https://api.yoursite.com"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 12, color: TEXT_MUTED, marginBottom: 6 }}>
                Carto Basemaps API Key <span style={{ opacity: 0.6 }}>(Optional)</span>
              </label>
              <input
                type="text"
                value={tempCartoKey}
                onChange={(e) => setTempCartoKey(e.target.value)}
                placeholder="Leave blank for anonymous Carto basemaps"
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 5, display: "block", lineHeight: 1.4 }}>
                Carto basemaps require an API key (passed as ?key=). Set it here, via VITE_CARTO_API_KEY, or CARTO_API_KEY on the backend.
              </span>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowEndpointModal(false)}
                style={{
                  padding: "8px 16px",
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  color: TEXT_SECONDARY,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEndpoint}
                style={{
                  padding: "8px 18px",
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                  border: "none",
                  borderRadius: 6,
                  color: "#0A1628",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Save & Connect
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
