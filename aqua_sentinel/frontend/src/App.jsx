import { useState, useEffect, useCallback, useRef } from "react";
import {
  ACCENT,
  ACCENT2,
  DEEP,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
  GLASS_BORDER,
} from "./utils/constants";
import { getApiBaseUrl } from "./utils/api";
import ParticleBackground from "./components/ParticleBackground";
import PulseRing from "./components/PulseRing";
import StatusDot from "./components/StatusDot";
import GlassCard from "./components/GlassCard";
import ScoreRing from "./components/ScoreRing";
import WaterLoader from "./components/WaterLoader";
import SensorChip from "./components/SensorChip";
import LakeHeatmap from "./components/LakeHeatmap";
import LiveTelemetryView from "./components/LiveTelemetryView";
import SnapshotReportView from "./components/SnapshotReportView";

// ─── Sample (simulated) block, shown alongside the real fetched batches ───
const jitter = (v, amt, min, max) =>
  Math.min(max, Math.max(min, v + (Math.random() - 0.5) * 2 * amt));

function makeSampleBatch(n = 15) {
  const now = Date.now();
  const readings = [];
  let p = {
    ph: 7.6,
    turbidity: 15,
    tds: 320,
    temperature: 17.5,
    latitude: 34.0837,
    longitude: 74.86,
  };
  for (let i = n - 1; i >= 0; i--) {
    p = {
      ph: jitter(p.ph, 0.15, 6.5, 9),
      turbidity: jitter(p.turbidity, 2, 1, 40),
      tds: jitter(p.tds, 15, 150, 600),
      temperature: jitter(p.temperature, 0.3, 10, 25),
      latitude: jitter(p.latitude, 0.0008, 34.07, 34.10),
      longitude: jitter(p.longitude, 0.0008, 74.84, 74.88),
    };
    readings.push({
      ...p,
      timestamp: new Date(now - i * 60000).toISOString(),
      device_id: "simulated",
    });
  }
  return {
    id: "sample",
    source: "sample",
    created_at: new Date(now).toISOString(),
    count: n,
    readings,
  };
}

const mean = (rs, k) => rs.reduce((s, r) => s + r[k], 0) / rs.length;
const BLOCK_TITLES = {
  sample: "Sample Data",
  fetch: "Fetched Data",
  push: "Received Data",
};

// ─── Reading Block ───
function ReadingBlock({ block, onReport }) {
  const [open, setOpen] = useState(false);
  const rs = block.readings;
  const isSample = block.source === "sample";
  return (
    <GlassCard hover={false} style={{ width: "100%", padding: "20px 24px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <StatusDot status={isSample ? "Caution" : "Normal"} />
          <span style={{ fontSize: 15, fontWeight: 500 }}>
            {BLOCK_TITLES[block.source] || "Readings"}
            {!isSample && ` #${block.id}`}
          </span>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              background: isSample ? "rgba(255,214,0,0.1)" : `${ACCENT}15`,
              color: isSample ? "#FFD600" : ACCENT,
            }}
          >
            {isSample ? "Simulated" : block.source === "fetch" ? "Fetched" : "Pushed"}
          </span>
        </div>
        <span
          style={{
            fontSize: 12,
            color: TEXT_MUTED,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {rs.length} reading{rs.length === 1 ? "" : "s"} ·{" "}
          {new Date(block.created_at).toLocaleString()}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 14,
        }}
      >
        {[
          ["Avg pH", mean(rs, "ph").toFixed(2)],
          ["Avg Turbidity", `${mean(rs, "turbidity").toFixed(1)} NTU`],
          ["Avg TDS", `${mean(rs, "tds").toFixed(0)} mg/L`],
          ["Avg Temp", `${mean(rs, "temperature").toFixed(1)} °C`],
          [
            "GPS Centre",
            `${mean(rs, "latitude").toFixed(4)}, ${mean(rs, "longitude").toFixed(4)}`,
          ],
        ].map(([lbl, val]) => (
          <div
            key={lbl}
            style={{
              background: "rgba(255,255,255,0.03)",
              borderRadius: 8,
              padding: "10px 8px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: TEXT_MUTED,
                letterSpacing: 1,
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              {lbl}
            </div>
            <div
              style={{
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 300,
              }}
            >
              {val}
            </div>
          </div>
        ))}
      </div>

      {open && (
        <div style={{ maxHeight: 220, overflowY: "auto", marginBottom: 14 }}>
          <table
            style={{
              width: "100%",
              fontSize: 12,
              fontFamily: "'JetBrains Mono', monospace",
              color: TEXT_SECONDARY,
              borderCollapse: "collapse",
            }}
          >
            <thead>
              <tr style={{ color: TEXT_MUTED, textAlign: "left" }}>
                {["Time", "pH", "Turb", "TDS", "Temp", "Lat", "Lon"].map((h) => (
                  <th key={h} style={{ fontWeight: 400, padding: "4px 6px" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rs.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${GLASS_BORDER}` }}>
                  <td style={{ padding: "4px 6px" }}>
                    {new Date(r.timestamp).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: "4px 6px" }}>{r.ph.toFixed(2)}</td>
                  <td style={{ padding: "4px 6px" }}>{r.turbidity.toFixed(1)}</td>
                  <td style={{ padding: "4px 6px" }}>{r.tds.toFixed(0)}</td>
                  <td style={{ padding: "4px 6px" }}>{r.temperature.toFixed(1)}</td>
                  <td style={{ padding: "4px 6px" }}>{r.latitude.toFixed(4)}</td>
                  <td style={{ padding: "4px 6px" }}>{r.longitude.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: "flex", gap: 12 }}>
        <button
          onClick={() => setOpen((o) => !o)}
          style={{
            flex: 1,
            padding: "12px",
            borderRadius: 10,
            border: `1px solid ${GLASS_BORDER}`,
            background: "rgba(255,255,255,0.03)",
            color: TEXT_SECONDARY,
            cursor: "pointer",
            fontSize: 13,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {open ? "Hide readings" : "View readings"}
        </button>
        <button
          onClick={() => onReport(block)}
          style={{
            flex: 2,
            padding: "12px",
            borderRadius: 10,
            border: "none",
            background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
            color: DEEP,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.5,
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          Generate Report
        </button>
      </div>
    </GlassCard>
  );
}

// ─── MAIN APP ───
export default function AquaSentinel() {
  // Navigation tabs: "live" | "batches" | "pdf" | "snapshot"
  const [currentTab, setCurrentTab] = useState("live");

  // Workflow states (shared by Batches & PDF modes)
  const [phase, setPhase] = useState("landing"); // landing | confirm | loading | dashboard
  const [fadeIn, setFadeIn] = useState(true);
  const [analysis, setAnalysis] = useState(null);

  // PDF Workflow state
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  // Batches Workflow state
  const [sampleBatch] = useState(() => makeSampleBatch());
  const [batches, setBatches] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null);
  const [feedError, setFeedError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [locationName, setLocationName] = useState("");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Load stored batches when Batches tab is active and in landing phase
  useEffect(() => {
    if (currentTab !== "batches" || phase !== "landing") return;
    let cancelled = false;
    (async () => {
      try {
        const baseUrl = getApiBaseUrl();
        const res = await fetch(`${baseUrl}/api/v1/batches`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setBatches(data.batches || []);
          setFeedError("");
        }
      } catch (e) {
        if (!cancelled) setFeedError(`Cannot reach backend (${e.message})`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentTab, phase, reloadKey]);

  const blocks = [...batches, sampleBatch];
  const blockReadings = selectedBlock?.readings || [];
  const centroid = blockReadings.length
    ? {
        lat: mean(blockReadings, "latitude"),
        lon: mean(blockReadings, "longitude"),
      }
    : null;

  const transition = useCallback((nextPhase, data) => {
    setFadeIn(false);
    setTimeout(() => {
      setPhase(nextPhase);
      if (data) setAnalysis(data);
      setFadeIn(true);
    }, 400);
  }, []);

  // Fetch readings from data-fetching source via backend
  const handleFetchData = async () => {
    setFetching(true);
    setFetchMsg(null);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/v1/readings/fetch`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      setReloadKey((k) => k + 1);
      setFetchMsg({
        ok: true,
        text: `Fetched ${data.fetched} reading${data.fetched === 1 ? "" : "s"} into a new block${
          data.skipped ? ` (${data.skipped} invalid skipped)` : ""
        }`,
      });
    } catch (e) {
      setFetchMsg({ ok: false, text: `Fetch failed: ${e.message}` });
    } finally {
      setFetching(false);
    }
  };

  const handleReport = (block) => {
    setSelectedBlock(block);
    setAnalysisError("");
    transition("confirm");
  };

  // PDF File handling
  const handleFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      alert("Please upload a PDF file.");
      return;
    }
    setSelectedFile(file);
    setFileName(file.name);
    transition("confirm");
  };

  // Confirm and run analysis
  const handleConfirm = async (confirmed) => {
    if (!confirmed) {
      transition("landing");
      return;
    }

    setAnalysisError("");
    transition("loading");

    const baseUrl = getApiBaseUrl();

    try {
      let res;
      if (currentTab === "pdf") {
        const formData = new FormData();
        formData.append("file", selectedFile);
        res = await fetch(`${baseUrl}/api/v1/analyse`, {
          method: "POST",
          body: formData,
        });
      } else {
        res = await fetch(`${baseUrl}/api/v1/analyse`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            location_name: locationName.trim() || null,
            readings: blockReadings,
          }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP error ${res.status}`);
      }

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      transition("dashboard", data);
    } catch (error) {
      console.error("Analysis failed:", error);
      setAnalysisError(`Analysis failed: ${error.message}`);
      alert(`Analysis failed: ${error.message}`);
      transition("landing");
    }
  };

  const handleReset = () => {
    transition("landing");
    setAnalysis(null);
    setFileName("");
    setSelectedFile(null);
    setSelectedBlock(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `linear-gradient(170deg, ${DEEP} 0%, #0D1F3C 40%, #0A2A3C 70%, #081C28 100%)`,
        fontFamily: "'Outfit', sans-serif",
        color: TEXT_PRIMARY,
        overflowX: "hidden",
        position: "relative",
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400&display=swap"
        rel="stylesheet"
      />
      <ParticleBackground />

      {/* ── Top Navigation Bar ── */}
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "rgba(10,22,40,0.85)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          padding: "0 28px",
          height: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${ACCENT}30, ${ACCENT2}30)`,
              border: `1px solid ${ACCENT}40`,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={ACCENT}
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: 2 }}>
              AQUA FISHER
            </span>
            <span
              style={{
                fontSize: 10,
                color: ACCENT,
                background: `${ACCENT}15`,
                padding: "2px 8px",
                borderRadius: 4,
                letterSpacing: 1.5,
                marginLeft: 6,
              }}
            >
              v0.2
            </span>
          </div>
        </div>

        {/* Center Navigation Tabs */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.04)",
            borderRadius: 10,
            padding: 4,
            border: "1px solid rgba(255,255,255,0.08)",
            gap: 4,
          }}
        >
          {[
            { id: "live", label: "🛰️ Dal Lake Digital Twin (Live)" },
            { id: "batches", label: "📑 Batch Readings" },
            { id: "pdf", label: "📄 Survey PDF Analysis" },
            { id: "snapshot", label: "📊 Snapshot & Reports (CRM)" },
          ].map((tab) => {
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setCurrentTab(tab.id);
                  setPhase("landing");
                  setAnalysis(null);
                }}
                style={{
                  background: active
                    ? `linear-gradient(135deg, ${ACCENT}25, ${ACCENT2}25)`
                    : "transparent",
                  color: active ? ACCENT : TEXT_SECONDARY,
                  border: active ? `1px solid ${ACCENT}50` : "1px solid transparent",
                  borderRadius: 8,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right side status / action */}
        <div>
          {phase === "dashboard" ? (
            <button
              onClick={handleReset}
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: TEXT_SECONDARY,
                padding: "8px 18px",
                cursor: "pointer",
                fontSize: 12,
                letterSpacing: 1,
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.target.style.borderColor = `${ACCENT}50`;
                e.target.style.color = ACCENT;
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = "rgba(255,255,255,0.1)";
                e.target.style.color = TEXT_SECONDARY;
              }}
            >
              New Analysis
            </button>
          ) : (
            <div style={{ fontSize: 11, color: TEXT_MUTED, letterSpacing: 1 }}>
              DAL LAKE &bull; 1,583m ASL
            </div>
          )}
        </div>
      </nav>

      {/* ── Content Container ── */}
      <div
        style={{
          paddingTop: 72,
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          opacity: fadeIn ? 1 : 0,
          transition: "opacity 0.4s ease",
        }}
      >
        {/* ════════ TAB 1: LIVE DIGITAL TWIN ════════ */}
        {currentTab === "live" && (
          <LiveTelemetryView onNavigateToSnapshot={() => setCurrentTab("snapshot")} />
        )}

        {/* ════════ TAB 2: BATCH READINGS (CMS FETCH / PUSH) ════════ */}
        {currentTab === "batches" && (
          <>
            {phase === "landing" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "calc(100vh - 72px)",
                  padding: "56px 24px 80px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "30%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.15,
                  }}
                >
                  <PulseRing size={400} />
                </div>

                <p
                  style={{
                    fontSize: 12,
                    letterSpacing: 6,
                    textTransform: "uppercase",
                    color: ACCENT,
                    marginBottom: 16,
                    fontWeight: 400,
                  }}
                >
                  Drone-Powered Intelligence
                </p>
                <h1
                  style={{
                    fontSize: "clamp(36px, 5vw, 56px)",
                    fontWeight: 200,
                    textAlign: "center",
                    lineHeight: 1.15,
                    margin: "0 0 16px",
                    maxWidth: 700,
                  }}
                >
                  Decode Your
                  <br />
                  <span
                    style={{
                      fontWeight: 500,
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Water Quality
                  </span>
                </h1>
                <p
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 16,
                    maxWidth: 500,
                    textAlign: "center",
                    lineHeight: 1.7,
                    margin: "0 0 48px",
                    fontWeight: 300,
                  }}
                >
                  Fetch readings from the drone monitoring system — each fetch arrives as
                  its own block. Generate an AI report on pH, turbidity, TDS,
                  temperature, and GPS for any block.
                </p>

                {/* Reading Blocks */}
                <div
                  style={{
                    width: "100%",
                    maxWidth: 760,
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 11,
                        letterSpacing: 3,
                        textTransform: "uppercase",
                        color: ACCENT,
                      }}
                    >
                      Reading Blocks
                    </span>
                    <button
                      disabled={fetching}
                      onClick={handleFetchData}
                      style={{
                        padding: "10px 22px",
                        borderRadius: 10,
                        border: `1px solid ${ACCENT}50`,
                        background: `${ACCENT}10`,
                        color: ACCENT,
                        cursor: fetching ? "wait" : "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: 0.5,
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    >
                      {fetching ? "Fetching…" : "Fetch Data"}
                    </button>
                  </div>
                  {feedError && (
                    <p style={{ fontSize: 12, color: "#FF6E6E", margin: 0 }}>
                      {feedError}
                    </p>
                  )}
                  {fetchMsg && (
                    <p
                      style={{
                        fontSize: 13,
                        color: fetchMsg.ok ? "#00E676" : "#FF6E6E",
                        margin: 0,
                      }}
                    >
                      {fetchMsg.text}
                    </p>
                  )}
                  {analysisError && (
                    <p style={{ fontSize: 13, color: "#FF6E6E", margin: 0 }}>
                      {analysisError}
                    </p>
                  )}
                  {blocks.map((block) => (
                    <ReadingBlock
                      key={block.id}
                      block={block}
                      onReport={handleReport}
                    />
                  ))}
                </div>

                {/* Sensor chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                    marginTop: 32,
                    maxWidth: 500,
                  }}
                >
                  {["pH", "Turbidity", "TDS", "Temperature", "GPS"].map((s) => (
                    <SensorChip key={s} label={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ TAB 3: ORIGINAL PDF WORKFLOW ════════ */}
        {currentTab === "pdf" && (
          <>
            {phase === "landing" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  minHeight: "calc(100vh - 72px)",
                  padding: "0 24px",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: "30%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    opacity: 0.15,
                  }}
                >
                  <PulseRing size={400} />
                </div>

                <p
                  style={{
                    fontSize: 12,
                    letterSpacing: 6,
                    textTransform: "uppercase",
                    color: ACCENT,
                    marginBottom: 16,
                    fontWeight: 400,
                  }}
                >
                  Drone-Powered Intelligence
                </p>
                <h1
                  style={{
                    fontSize: "clamp(36px, 5vw, 56px)",
                    fontWeight: 200,
                    textAlign: "center",
                    lineHeight: 1.15,
                    margin: "0 0 16px",
                    maxWidth: 700,
                  }}
                >
                  Decode Your
                  <br />
                  <span
                    style={{
                      fontWeight: 500,
                      background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Water Quality
                  </span>
                </h1>
                <p
                  style={{
                    color: TEXT_SECONDARY,
                    fontSize: 16,
                    maxWidth: 500,
                    textAlign: "center",
                    lineHeight: 1.7,
                    margin: "0 0 48px",
                    fontWeight: 300,
                  }}
                >
                  Upload your drone sensor data PDF and let our AI analyze pH,
                  turbidity, dissolved oxygen, temperature, conductivity, ammonia, ORP,
                  and GPS coordinates in seconds.
                </p>

                {/* Upload Zone */}
                <input
                  ref={fileRef}
                  id="pdf-upload"
                  type="file"
                  accept=".pdf"
                  style={{ display: "none" }}
                  onChange={(e) => handleFile(e.target.files[0])}
                />
                <label
                  htmlFor="pdf-upload"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files[0]);
                  }}
                  style={{
                    width: "100%",
                    maxWidth: 520,
                    padding: "48px 40px",
                    border: `2px dashed ${
                      dragOver ? ACCENT : "rgba(255,255,255,0.12)"
                    }`,
                    borderRadius: 20,
                    cursor: "pointer",
                    background: dragOver ? `${ACCENT}08` : "rgba(255,255,255,0.02)",
                    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 16,
                      background: `linear-gradient(135deg, ${ACCENT}15, ${ACCENT2}15)`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: `1px solid ${ACCENT}25`,
                    }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={ACCENT}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <polyline points="9 15 12 12 15 15" />
                    </svg>
                  </div>
                  {fileName ? (
                    <div style={{ textAlign: "center" }}>
                      <p
                        style={{
                          fontSize: 15,
                          fontWeight: 500,
                          margin: 0,
                          color: ACCENT,
                        }}
                      >
                        {fileName}
                      </p>
                      <p style={{ fontSize: 12, color: TEXT_MUTED, margin: "6px 0 0" }}>
                        PDF loaded successfully
                      </p>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 15, fontWeight: 400, margin: 0 }}>
                        Drop your sensor data PDF here
                      </p>
                      <p style={{ fontSize: 13, color: TEXT_MUTED, margin: "6px 0 0" }}>
                        or click to browse — supports .pdf
                      </p>
                    </div>
                  )}
                </label>

                {/* Sensor chips */}
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 8,
                    justifyContent: "center",
                    marginTop: 32,
                    maxWidth: 500,
                  }}
                >
                  {[
                    "pH",
                    "Turbidity",
                    "DO",
                    "Temperature",
                    "Conductivity",
                    "NH₃",
                    "ORP",
                    "GPS",
                  ].map((s) => (
                    <SensorChip key={s} label={s} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ════════ SHARED: LOCATION CONFIRM (FOR BATCHES & PDF) ════════ */}
        {phase === "confirm" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "calc(100vh - 72px)",
              padding: "0 24px",
            }}
          >
            <GlassCard
              style={{
                maxWidth: 480,
                width: "100%",
                textAlign: "center",
                padding: "48px 40px",
              }}
              glow={ACCENT}
              hover={false}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  margin: "0 auto 24px",
                  background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT2}20)`,
                  border: `1px solid ${ACCENT}30`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
                Confirm survey location
              </h2>
              <p
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 14,
                  margin: "0 0 32px",
                  lineHeight: 1.6,
                }}
              >
                {currentTab === "batches"
                  ? "Location is inferred from GPS readings. Optionally name the water body."
                  : "We detected the following location from your sensor data. Is this correct?"}
              </p>

              <div
                style={{
                  background: "rgba(0,229,255,0.04)",
                  border: `1px solid ${ACCENT}20`,
                  borderRadius: 12,
                  padding: "20px",
                  marginBottom: 32,
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Location
                  </span>
                  {currentTab === "batches" ? (
                    <input
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="Auto-detect from GPS"
                      style={{
                        background: "transparent",
                        border: `1px solid ${GLASS_BORDER}`,
                        borderRadius: 6,
                        padding: "6px 10px",
                        color: TEXT_PRIMARY,
                        fontSize: 14,
                        textAlign: "right",
                        fontFamily: "'Outfit', sans-serif",
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 14, fontWeight: 400 }}>
                      Dal Lake, Srinagar, J&K
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 12,
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    Coordinates
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 300,
                      color: ACCENT,
                    }}
                  >
                    {centroid
                      ? `${centroid.lat.toFixed(4)}°N, ${centroid.lon.toFixed(4)}°E`
                      : "34.0837°N, 74.8600°E"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      letterSpacing: 1.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {currentTab === "batches" ? "Block" : "Elevation"}
                  </span>
                  <span style={{ fontSize: 14 }}>
                    {currentTab === "batches" && selectedBlock
                      ? `${
                          BLOCK_TITLES[selectedBlock.source] || "Readings"
                        }${
                          selectedBlock.source === "sample"
                            ? ""
                            : ` #${selectedBlock.id}`
                        } · ${blockReadings.length} readings`
                      : "1,583 m ASL"}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button
                  onClick={() => handleConfirm(false)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 12,
                    border: `1px solid rgba(255,255,255,0.1)`,
                    background: "rgba(255,255,255,0.03)",
                    color: TEXT_SECONDARY,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 400,
                    letterSpacing: 0.5,
                    transition: "all 0.3s",
                    fontFamily: "'Outfit', sans-serif",
                  }}
                  onMouseEnter={(e) => (e.target.style.borderColor = "#FF174440")}
                  onMouseLeave={(e) =>
                    (e.target.style.borderColor = "rgba(255,255,255,0.1)")
                  }
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirm(true)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 12,
                    border: "none",
                    background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
                    color: DEEP,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    letterSpacing: 0.5,
                    transition: "all 0.3s",
                    fontFamily: "'Outfit', sans-serif",
                    boxShadow: `0 4px 24px ${ACCENT}30`,
                  }}
                  onMouseEnter={(e) =>
                    (e.target.style.transform = "translateY(-1px)")
                  }
                  onMouseLeave={(e) => (e.target.style.transform = "none")}
                >
                  Yes, analyze
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ════════ SHARED: LOADING SCREEN ════════ */}
        {phase === "loading" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: "calc(100vh - 72px)",
            }}
          >
            <WaterLoader
              text={
                currentTab === "batches"
                  ? "Testing sensors and compiling report..."
                  : "Analyzing Dal Lake sensor data..."
              }
            />
          </div>
        )}

        {/* ════════ SHARED: DASHBOARD REPORT ════════ */}
        {phase === "dashboard" && analysis && (
          <div
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "40px 24px 80px",
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 4,
                  textTransform: "uppercase",
                  color: ACCENT,
                  margin: "0 0 8px",
                }}
              >
                Analysis Complete
              </p>
              <h1 style={{ fontSize: 32, fontWeight: 300, margin: "0 0 6px" }}>
                {analysis.report_title}
              </h1>
              <p
                style={{
                  color: TEXT_MUTED,
                  fontSize: 13,
                  margin: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {analysis.location?.name} —{" "}
                {analysis.location?.coordinates?.latitude}°N,{" "}
                {analysis.location?.coordinates?.longitude}°E —{" "}
                {analysis.location?.elevation_m}m ASL
              </p>
            </div>

            {/* WQI + Summary Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr",
                gap: 20,
                marginBottom: 24,
              }}
            >
              <GlassCard
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 32,
                }}
                glow={ACCENT}
              >
                <ScoreRing
                  score={analysis.overall_water_quality_index?.score}
                  label={analysis.overall_water_quality_index?.category}
                />
              </GlassCard>
              <GlassCard hover={false}>
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: 3,
                    textTransform: "uppercase",
                    color: ACCENT,
                    margin: "0 0 16px",
                  }}
                >
                  Executive Summary
                </p>
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.8,
                    color: TEXT_SECONDARY,
                    margin: 0,
                    fontWeight: 300,
                  }}
                >
                  {analysis.overall_water_quality_index?.summary}
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 20,
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 12px",
                      borderRadius: 6,
                      background: "rgba(255,214,0,0.1)",
                      color: "#FFD600",
                      letterSpacing: 1,
                    }}
                  >
                    {analysis.regulatory_compliance_summary?.overall_compliance}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 12px",
                      borderRadius: 6,
                      background: "rgba(255,23,68,0.1)",
                      color: "#FF6E6E",
                      letterSpacing: 1,
                    }}
                  >
                    {analysis.ecological_assessment?.trophic_state}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "4px 12px",
                      borderRadius: 6,
                      background: "rgba(255,23,68,0.1)",
                      color: "#FF6E6E",
                      letterSpacing: 1,
                    }}
                  >
                    Algal Bloom Risk:{" "}
                    {analysis.ecological_assessment?.algal_bloom_risk}
                  </span>
                </div>
              </GlassCard>
            </div>

            {/* Parameter Cards Grid */}
            <p
              style={{
                fontSize: 11,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: ACCENT,
                margin: "32px 0 16px",
              }}
            >
              Parameter Analysis
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {analysis.parameter_analysis?.map((p, i) => (
                <GlassCard key={i} style={{ padding: "20px 24px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 16,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <StatusDot status={p.status} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>
                        {p.parameter}
                      </span>
                      {p.unit !== "—" && (
                        <span
                          style={{
                            fontSize: 11,
                            color: TEXT_MUTED,
                            marginLeft: 6,
                          }}
                        >
                          ({p.unit})
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "3px 10px",
                        borderRadius: 4,
                        letterSpacing: 1.5,
                        textTransform: "uppercase",
                        background:
                          p.compliance === "Compliant"
                            ? "rgba(0,230,118,0.1)"
                            : p.compliance === "Non-compliant"
                            ? "rgba(255,23,68,0.1)"
                            : "rgba(255,214,0,0.1)",
                        color:
                          p.compliance === "Compliant"
                            ? "#00E676"
                            : p.compliance === "Non-compliant"
                            ? "#FF6E6E"
                            : "#FFD600",
                      }}
                    >
                      {p.compliance}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                      marginBottom: 14,
                    }}
                  >
                    {[
                      ["Min", p.stats?.min],
                      ["Max", p.stats?.max],
                      ["Mean", p.stats?.mean],
                      ["σ", p.stats?.std_dev],
                    ].map(([lbl, val]) => (
                      <div
                        key={lbl}
                        style={{
                          background: "rgba(255,255,255,0.03)",
                          borderRadius: 8,
                          padding: "8px",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color: TEXT_MUTED,
                            letterSpacing: 1,
                            textTransform: "uppercase",
                            marginBottom: 4,
                          }}
                        >
                          {lbl}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 300,
                          }}
                        >
                          {typeof val === "number" ? val.toFixed(2) : val}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      color: TEXT_SECONDARY,
                      lineHeight: 1.7,
                      margin: "0 0 8px",
                    }}
                  >
                    {p.interpretation}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: TEXT_MUTED,
                      lineHeight: 1.6,
                      margin: 0,
                      fontStyle: "italic",
                    }}
                  >
                    {p.health_implications}
                  </p>
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 10,
                      color: TEXT_MUTED,
                      letterSpacing: 0.5,
                    }}
                  >
                    Standard: {p.applicable_standard}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Ecological + Contamination Row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
                marginBottom: 24,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    color: ACCENT,
                    margin: "16px 0 12px",
                  }}
                >
                  Ecological Assessment
                </p>
                <GlassCard hover={false}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 22,
                        fontWeight: 300,
                        color: "#FF6E6E",
                      }}
                    >
                      {analysis.ecological_assessment?.trophic_state}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 13,
                      color: TEXT_SECONDARY,
                      lineHeight: 1.7,
                      margin: "0 0 12px",
                    }}
                  >
                    {analysis.ecological_assessment?.trophic_justification}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      lineHeight: 1.6,
                      margin: "0 0 8px",
                    }}
                  >
                    {analysis.ecological_assessment?.biodiversity_impact}
                  </p>
                </GlassCard>
              </div>
              <div>
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: 4,
                    textTransform: "uppercase",
                    color: ACCENT,
                    margin: "16px 0 12px",
                  }}
                >
                  Contamination Sources
                </p>
                <GlassCard hover={false}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {analysis.contamination_analysis?.likely_pollution_sources?.map(
                      (src, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: ACCENT,
                              opacity: 0.6,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>
                            {src}
                          </span>
                        </div>
                      )
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: 12,
                      color: TEXT_MUTED,
                      lineHeight: 1.6,
                      margin: "16px 0 0",
                    }}
                  >
                    {analysis.contamination_analysis?.nutrient_loading_assessment}
                  </p>
                </GlassCard>
              </div>
            </div>

            {/* Recommendations */}
            <p
              style={{
                fontSize: 11,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: ACCENT,
                margin: "16px 0 12px",
              }}
            >
              Recommendations
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {[
                {
                  title: "Immediate Actions",
                  items: analysis.recommendations?.immediate_actions || [],
                  color: "#FF6E6E",
                  icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8",
                },
                {
                  title: "Monitoring Plan",
                  items: analysis.recommendations?.monitoring_plan || [],
                  color: "#FFD600",
                  icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
                },
                {
                  title: "Long-term Remediation",
                  items: analysis.recommendations?.long_term_remediation || [],
                  color: "#00E676",
                  icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9 12l2 2 4-4",
                },
              ].map(({ title, items, color, icon }) => (
                <GlassCard
                  key={title}
                  hover={false}
                  style={{ padding: "20px 24px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 16,
                    }}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={color}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d={icon} />
                    </svg>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        letterSpacing: 1,
                      }}
                    >
                      {title}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {items.map((item, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "flex-start",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            color: TEXT_MUTED,
                            fontFamily: "'JetBrains Mono', monospace",
                            marginTop: 2,
                            flexShrink: 0,
                          }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          style={{
                            fontSize: 13,
                            color: TEXT_SECONDARY,
                            lineHeight: 1.6,
                          }}
                        >
                          {item}
                        </span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Spatial Heatmap */}
            <p
              style={{
                fontSize: 11,
                letterSpacing: 4,
                textTransform: "uppercase",
                color: ACCENT,
                margin: "32px 0 12px",
              }}
            >
              Spatial Heatmap
            </p>
            <GlassCard
              hover={false}
              style={{
                padding: 0,
                overflow: "hidden",
                minHeight: 400,
                position: "relative",
              }}
            >
              <LakeHeatmap analysis={analysis} />
            </GlassCard>

            {/* Confidence Notes */}
            <div
              style={{
                marginTop: 32,
                padding: "16px 20px",
                borderRadius: 12,
                border: `1px solid rgba(255,214,0,0.15)`,
                background: "rgba(255,214,0,0.03)",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#FFD600",
                  margin: "0 0 8px",
                }}
              >
                Confidence Notes
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: TEXT_SECONDARY,
                  lineHeight: 1.7,
                  margin: 0,
                }}
              >
                {analysis.confidence_notes}
              </p>
            </div>
          </div>
        )}

        {/* ════════ TAB 4: SNAPSHOT REPORT VIEW ════════ */}
        {currentTab === "snapshot" && <SnapshotReportView />}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
        ::selection { background: ${ACCENT}40; color: white; }
      `}</style>
    </div>
  );
}
