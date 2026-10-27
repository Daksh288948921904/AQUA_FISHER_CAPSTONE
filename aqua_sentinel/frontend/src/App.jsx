import { useState, useEffect, useCallback } from "react";
import { ACCENT, ACCENT2, DEEP, TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED, GLASS_BORDER } from "./utils/constants";
import ParticleBackground from "./components/ParticleBackground";
import PulseRing from "./components/PulseRing";
import StatusDot from "./components/StatusDot";
import GlassCard from "./components/GlassCard";
import ScoreRing from "./components/ScoreRing";
import WaterLoader from "./components/WaterLoader";
import SensorChip from "./components/SensorChip";
import LakeHeatmap from "./components/LakeHeatmap";

// ─── API ───
// Set VITE_API_URL at build time (e.g. https://aqua-sentinel-api.onrender.com); a bare host gets https://
const RAW_API = (import.meta.env.VITE_API_URL || "http://localhost:8000").trim().replace(/\/+$/, "");
const API_BASE = /^https?:\/\//.test(RAW_API) ? RAW_API : `https://${RAW_API}`;
const POLL_MS = 3000;

// ─── Simulated readings (shown until the data-fetching app pushes real data) ───
const jitter = (v, amt, min, max) => Math.min(max, Math.max(min, v + (Math.random() - 0.5) * 2 * amt));
function makeFakeReading(prev) {
  const p = prev || { ph: 7.6, turbidity: 15, tds: 320, temperature: 17.5, latitude: 34.0837, longitude: 74.86 };
  return {
    timestamp: new Date().toISOString(),
    device_id: "simulated",
    ph: jitter(p.ph, 0.15, 6.5, 9),
    turbidity: jitter(p.turbidity, 2, 1, 40),
    tds: jitter(p.tds, 15, 150, 600),
    temperature: jitter(p.temperature, 0.3, 10, 25),
    latitude: jitter(p.latitude, 0.0008, 34.07, 34.10),
    longitude: jitter(p.longitude, 0.0008, 74.84, 74.88),
  };
}
function makeFakeReadings(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(makeFakeReading(out[i - 1]));
  return out;
}

// ─── MAIN APP ───
export default function AquaSentinel() {
  const [phase, setPhase] = useState("landing"); // landing | confirm | loading | dashboard
  const [readings, setReadings] = useState([]);
  const [simulated, setSimulated] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [analysisError, setAnalysisError] = useState("");
  const [locationName, setLocationName] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [fadeIn, setFadeIn] = useState(true);

  // Poll the live readings pushed by the data-fetching application
  useEffect(() => {
    if (phase !== "landing") return;
    let cancelled = false;
    // No real data yet: seed simulated readings, then append one per poll so the feed looks live
    const simulate = () => {
      setSimulated(true);
      setReadings(prev => {
        if (!prev.length || prev[0].device_id !== "simulated") return makeFakeReadings(12);
        return [...prev, makeFakeReading(prev[prev.length - 1])].slice(-200);
      });
    };
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/readings`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled) return;
        setFeedError("");
        if (data.readings.length) { setReadings(data.readings); setSimulated(false); }
        else simulate();
      } catch (e) {
        if (cancelled) return;
        setFeedError(`Cannot reach sensor feed (${e.message}) — showing simulated readings`);
        simulate();
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [phase]);

  const latest = readings[readings.length - 1];
  const centroid = readings.length ? {
    lat: readings.reduce((s, r) => s + r.latitude, 0) / readings.length,
    lon: readings.reduce((s, r) => s + r.longitude, 0) / readings.length,
  } : null;

  const transition = useCallback((nextPhase, data) => {
    setFadeIn(false);
    setTimeout(() => {
      setPhase(nextPhase);
      if (data) setAnalysis(data);
      setFadeIn(true);
    }, 500);
  }, []);

  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState(null); // { ok, text }

  // Pull readings from the data-fetching system via the backend, then refresh the feed
  const handleFetchData = async () => {
    setFetching(true);
    setFetchMsg(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/readings/fetch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      const list = await (await fetch(`${API_BASE}/api/v1/readings`)).json();
      if (list.readings.length) { setReadings(list.readings); setSimulated(false); }
      setFetchMsg({ ok: true, text: `Fetched ${data.fetched} reading${data.fetched === 1 ? "" : "s"}${data.skipped ? ` (${data.skipped} invalid skipped)` : ""}` });
    } catch (e) {
      setFetchMsg({ ok: false, text: `Fetch failed: ${e.message}` });
    } finally {
      setFetching(false);
    }
  };

  const handleConfirm = async (confirmed) => {
    if (!confirmed) {
      transition("landing");
      return;
    }
    setAnalysisError("");
    transition("loading");
    try {
      const res = await fetch(`${API_BASE}/api/v1/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location_name: locationName.trim() || null, readings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `HTTP ${res.status}`);
      if (data.error) throw new Error(data.error);
      transition("dashboard", data);
    } catch (e) {
      setAnalysisError(`Analysis failed: ${e.message}`);
      transition("landing");
    }
  };

  const handleReset = () => {
    transition("landing");
    setAnalysis(null);
  };

  return (
    <div style={{
      minHeight: "100vh", background: `linear-gradient(170deg, ${DEEP} 0%, #0D1F3C 40%, #0A2A3C 70%, #081C28 100%)`,
      fontFamily: "'Outfit', sans-serif", color: TEXT_PRIMARY, overflow: "hidden", position: "relative",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@300;400&display=swap" rel="stylesheet" />
      <ParticleBackground />

      {/* ── Top Nav ── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: "rgba(10,22,40,0.7)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
        padding: "0 40px", height: 64, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
            background: `linear-gradient(135deg, ${ACCENT}30, ${ACCENT2}30)`, border: `1px solid ${ACCENT}40`,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span style={{ fontSize: 16, fontWeight: 500, letterSpacing: 2 }}>AQUA FISHER</span>
          <span style={{ fontSize: 10, color: ACCENT, background: `${ACCENT}15`, padding: "2px 8px", borderRadius: 4, letterSpacing: 1.5, marginLeft: 4 }}>v0.1</span>
        </div>
        {phase === "dashboard" && (
          <button onClick={handleReset} style={{
            background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8,
            color: TEXT_SECONDARY, padding: "8px 20px", cursor: "pointer", fontSize: 13, letterSpacing: 1,
            transition: "all 0.3s",
          }}
            onMouseEnter={e => { e.target.style.borderColor = `${ACCENT}50`; e.target.style.color = ACCENT; }}
            onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.color = TEXT_SECONDARY; }}
          >
            New Analysis
          </button>
        )}
      </nav>

      {/* ── Content ── */}
      <div style={{
        paddingTop: 64, minHeight: "100vh", position: "relative", zIndex: 1,
        opacity: fadeIn ? 1 : 0, transition: "opacity 0.5s ease",
      }}>

        {/* ════════ LANDING ════════ */}
        {phase === "landing" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "0 24px" }}>
            <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)", opacity: 0.15 }}>
              <PulseRing size={400} />
            </div>

            <p style={{ fontSize: 12, letterSpacing: 6, textTransform: "uppercase", color: ACCENT, marginBottom: 16, fontWeight: 400 }}>
              Drone-Powered Intelligence
            </p>
            <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 200, textAlign: "center", lineHeight: 1.15, margin: "0 0 16px", maxWidth: 700 }}>
              Decode Your<br />
              <span style={{ fontWeight: 500, background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Water Quality
              </span>
            </h1>
            <p style={{ color: TEXT_SECONDARY, fontSize: 16, maxWidth: 500, textAlign: "center", lineHeight: 1.7, margin: "0 0 48px", fontWeight: 300 }}>
              Live readings from the drone monitoring system stream in below. Our AI analyzes pH, turbidity, TDS, temperature, and GPS coordinates in seconds.
            </p>

            {/* Live Readings Feed */}
            <GlassCard hover={false} style={{ width: "100%", maxWidth: 720, padding: "24px 28px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <StatusDot status={feedError ? "Critical" : simulated ? "Caution" : "Normal"} />
                  <span style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: ACCENT }}>Live Sensor Feed</span>
                  {simulated && (
                    <span style={{ fontSize: 10, marginLeft: 10, padding: "2px 8px", borderRadius: 4, letterSpacing: 1.5, textTransform: "uppercase", background: "rgba(255,214,0,0.1)", color: "#FFD600" }}>
                      Simulated
                    </span>
                  )}
                </div>
                <span style={{ fontSize: 12, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace" }}>
                  {readings.length} reading{readings.length === 1 ? "" : "s"}
                </span>
              </div>

              {feedError && <p style={{ fontSize: 12, color: "#FF6E6E", margin: "0 0 12px" }}>{feedError}</p>}
              {!latest ? (
                <p style={{ fontSize: 13, color: TEXT_MUTED, margin: 0 }}>Waiting for readings from the data-fetching application…</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                    {[
                      ["pH", latest.ph.toFixed(2)],
                      ["Turbidity", `${latest.turbidity.toFixed(1)} NTU`],
                      ["TDS", `${latest.tds.toFixed(0)} mg/L`],
                      ["Temp", `${latest.temperature.toFixed(1)} °C`],
                      ["GPS", `${latest.latitude.toFixed(4)}, ${latest.longitude.toFixed(4)}`],
                    ].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{lbl}</div>
                        <div style={{ fontSize: 13, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ maxHeight: 180, overflowY: "auto" }}>
                    <table style={{ width: "100%", fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: TEXT_SECONDARY, borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ color: TEXT_MUTED, textAlign: "left" }}>
                          {["Time", "pH", "Turb", "TDS", "Temp", "Lat", "Lon"].map(h => <th key={h} style={{ fontWeight: 400, padding: "4px 6px" }}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {readings.slice(-20).reverse().map((r, i) => (
                          <tr key={i} style={{ borderTop: `1px solid ${GLASS_BORDER}` }}>
                            <td style={{ padding: "4px 6px" }}>{new Date(r.timestamp).toLocaleTimeString()}</td>
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
                </>
              )}

              {analysisError && <p style={{ fontSize: 13, color: "#FF6E6E", margin: "16px 0 0" }}>{analysisError}</p>}
              {fetchMsg && <p style={{ fontSize: 13, color: fetchMsg.ok ? "#00E676" : "#FF6E6E", margin: "16px 0 0" }}>{fetchMsg.text}</p>}

              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button
                disabled={fetching}
                onClick={handleFetchData}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: `1px solid ${ACCENT}50`,
                  background: `${ACCENT}10`, color: ACCENT, cursor: fetching ? "wait" : "pointer",
                  fontSize: 14, fontWeight: 600, letterSpacing: 0.5, fontFamily: "'Outfit', sans-serif",
                }}
              >
                {fetching ? "Fetching…" : "Fetch Data"}
              </button>
              <button
                disabled={!readings.length}
                onClick={() => transition("confirm")}
                style={{
                  flex: 2, padding: "14px", borderRadius: 12, border: "none",
                  background: readings.length ? `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})` : "rgba(255,255,255,0.05)",
                  color: readings.length ? DEEP : TEXT_MUTED, cursor: readings.length ? "pointer" : "not-allowed",
                  fontSize: 14, fontWeight: 600, letterSpacing: 0.5, fontFamily: "'Outfit', sans-serif",
                }}
              >
                Analyze {readings.length || ""} reading{readings.length === 1 ? "" : "s"}
              </button>
              </div>
            </GlassCard>

            {/* Sensor chips */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 32, maxWidth: 500 }}>
              {["pH", "Turbidity", "TDS", "Temperature", "GPS"].map((s) => (
                <SensorChip key={s} label={s} />
              ))}
            </div>
          </div>
        )}

        {/* ════════ LOCATION CONFIRM ════════ */}
        {phase === "confirm" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)", padding: "0 24px" }}>
            <GlassCard style={{ maxWidth: 480, width: "100%", textAlign: "center", padding: "48px 40px" }} glow={ACCENT} hover={false}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, margin: "0 auto 24px",
                background: `linear-gradient(135deg, ${ACCENT}20, ${ACCENT2}20)`, border: `1px solid ${ACCENT}30`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>Confirm survey location</h2>
              <p style={{ color: TEXT_SECONDARY, fontSize: 14, margin: "0 0 32px", lineHeight: 1.6 }}>
                Location is inferred from the GPS readings. Optionally name the water body to guide the analysis.
              </p>

              <div style={{
                background: "rgba(0,229,255,0.04)", border: `1px solid ${ACCENT}20`, borderRadius: 12,
                padding: "20px", marginBottom: 32, textAlign: "left",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: TEXT_MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>Location</span>
                  <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Auto-detect from GPS" style={{
                    background: "transparent", border: `1px solid ${GLASS_BORDER}`, borderRadius: 6, padding: "6px 10px",
                    color: TEXT_PRIMARY, fontSize: 14, textAlign: "right", fontFamily: "'Outfit', sans-serif",
                  }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 12, color: TEXT_MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>GPS Centroid</span>
                  <span style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300, color: ACCENT }}>
                    {centroid && `${centroid.lat.toFixed(4)}°, ${centroid.lon.toFixed(4)}°`}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 12, color: TEXT_MUTED, letterSpacing: 1.5, textTransform: "uppercase" }}>Samples</span>
                  <span style={{ fontSize: 14 }}>{readings.length}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => handleConfirm(false)} style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: `1px solid rgba(255,255,255,0.1)`,
                  background: "rgba(255,255,255,0.03)", color: TEXT_SECONDARY, cursor: "pointer",
                  fontSize: 14, fontWeight: 400, letterSpacing: 0.5, transition: "all 0.3s",
                  fontFamily: "'Outfit', sans-serif",
                }}
                  onMouseEnter={e => e.target.style.borderColor = "#FF174440"}
                  onMouseLeave={e => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
                >
                  No, go back
                </button>
                <button onClick={() => handleConfirm(true)} style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "none",
                  background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`, color: DEEP,
                  cursor: "pointer", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
                  transition: "all 0.3s", fontFamily: "'Outfit', sans-serif",
                  boxShadow: `0 4px 24px ${ACCENT}30`,
                }}
                  onMouseEnter={e => e.target.style.transform = "translateY(-1px)"}
                  onMouseLeave={e => e.target.style.transform = "none"}
                >
                  Yes, analyze
                </button>
              </div>
            </GlassCard>
          </div>
        )}

        {/* ════════ LOADING ════════ */}
        {phase === "loading" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "calc(100vh - 64px)" }}>
            <WaterLoader text={`Analyzing ${readings.length} sensor readings...`} />
          </div>
        )}

        {/* ════════ DASHBOARD ════════ */}
        {phase === "dashboard" && analysis && (
          <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px 80px" }}>

            {/* Header */}
            <div style={{ marginBottom: 40 }}>
              <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "0 0 8px" }}>Analysis Complete</p>
              <h1 style={{ fontSize: 32, fontWeight: 300, margin: "0 0 6px" }}>{analysis.report_title}</h1>
              <p style={{ color: TEXT_MUTED, fontSize: 13, margin: 0, fontFamily: "'JetBrains Mono', monospace" }}>
                {analysis.location.name} — {analysis.location.coordinates.latitude}°N, {analysis.location.coordinates.longitude}°E — {analysis.location.elevation_m}m ASL
              </p>
            </div>

            {/* WQI + Summary Row */}
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20, marginBottom: 24 }}>
              <GlassCard style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }} glow={ACCENT}>
                <ScoreRing score={analysis.overall_water_quality_index.score} label={analysis.overall_water_quality_index.category} />
              </GlassCard>
              <GlassCard hover={false}>
                <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: ACCENT, margin: "0 0 16px" }}>Executive Summary</p>
                <p style={{ fontSize: 15, lineHeight: 1.8, color: TEXT_SECONDARY, margin: 0, fontWeight: 300 }}>
                  {analysis.overall_water_quality_index.summary}
                </p>
                <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,214,0,0.1)", color: "#FFD600", letterSpacing: 1 }}>
                    {analysis.regulatory_compliance_summary.overall_compliance}
                  </span>
                  <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,23,68,0.1)", color: "#FF6E6E", letterSpacing: 1 }}>
                    {analysis.ecological_assessment.trophic_state}
                  </span>
                  <span style={{ fontSize: 11, padding: "4px 12px", borderRadius: 6, background: "rgba(255,23,68,0.1)", color: "#FF6E6E", letterSpacing: 1 }}>
                    Algal Bloom Risk: {analysis.ecological_assessment.algal_bloom_risk}
                  </span>
                </div>
              </GlassCard>
            </div>

            {/* Parameter Cards Grid */}
            <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "32px 0 16px" }}>Parameter Analysis</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginBottom: 24 }}>
              {analysis.parameter_analysis.map((p, i) => (
                <GlassCard key={i} style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <StatusDot status={p.status} />
                      <span style={{ fontSize: 15, fontWeight: 500 }}>{p.parameter}</span>
                      {p.unit !== "—" && <span style={{ fontSize: 11, color: TEXT_MUTED, marginLeft: 6 }}>({p.unit})</span>}
                    </div>
                    <span style={{
                      fontSize: 10, padding: "3px 10px", borderRadius: 4, letterSpacing: 1.5, textTransform: "uppercase",
                      background: p.compliance === "Compliant" ? "rgba(0,230,118,0.1)" : p.compliance === "Non-compliant" ? "rgba(255,23,68,0.1)" : "rgba(255,214,0,0.1)",
                      color: p.compliance === "Compliant" ? "#00E676" : p.compliance === "Non-compliant" ? "#FF6E6E" : "#FFD600",
                    }}>{p.compliance}</span>
                  </div>

                  {/* Stats bar */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 14 }}>
                    {[["Min", p.stats.min], ["Max", p.stats.max], ["Mean", p.stats.mean], ["σ", p.stats.std_dev]].map(([lbl, val]) => (
                      <div key={lbl} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 8, padding: "8px", textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: TEXT_MUTED, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{lbl}</div>
                        <div style={{ fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 300 }}>{typeof val === "number" ? val.toFixed(2) : val}</div>
                      </div>
                    ))}
                  </div>

                  <p style={{ fontSize: 12, color: TEXT_SECONDARY, lineHeight: 1.7, margin: "0 0 8px" }}>{p.interpretation}</p>
                  <p style={{ fontSize: 11, color: TEXT_MUTED, lineHeight: 1.6, margin: 0, fontStyle: "italic" }}>{p.health_implications}</p>
                  <div style={{ marginTop: 10, fontSize: 10, color: TEXT_MUTED, letterSpacing: 0.5 }}>
                    Standard: {p.applicable_standard}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Ecological + Contamination Row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "16px 0 12px" }}>Ecological Assessment</p>
                <GlassCard hover={false}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                    <span style={{
                      fontSize: 22, fontWeight: 300, color: "#FF6E6E",
                    }}>{analysis.ecological_assessment.trophic_state}</span>
                  </div>
                  <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.7, margin: "0 0 12px" }}>{analysis.ecological_assessment.trophic_justification}</p>
                  <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6, margin: "0 0 8px" }}>{analysis.ecological_assessment.biodiversity_impact}</p>
                </GlassCard>
              </div>
              <div>
                <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "16px 0 12px" }}>Contamination Sources</p>
                <GlassCard hover={false}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {analysis.contamination_analysis.likely_pollution_sources.map((src, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, opacity: 0.6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, color: TEXT_SECONDARY }}>{src}</span>
                      </div>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.6, margin: "16px 0 0" }}>{analysis.contamination_analysis.nutrient_loading_assessment}</p>
                </GlassCard>
              </div>
            </div>

            {/* Recommendations */}
            <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "16px 0 12px" }}>Recommendations</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { title: "Immediate Actions", items: analysis.recommendations.immediate_actions, color: "#FF6E6E", icon: "M13 2L3 14h9l-1 8 10-12h-9l1-8" },
                { title: "Monitoring Plan", items: analysis.recommendations.monitoring_plan, color: "#FFD600", icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z" },
                { title: "Long-term Remediation", items: analysis.recommendations.long_term_remediation, color: "#00E676", icon: "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM9 12l2 2 4-4" },
              ].map(({ title, items, color, icon }) => (
                <GlassCard key={title} hover={false} style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d={icon} />
                    </svg>
                    <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 1 }}>{title}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {items.map((item, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 11, color: TEXT_MUTED, fontFamily: "'JetBrains Mono', monospace", marginTop: 2, flexShrink: 0 }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.6 }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>

            {/* Spatial Heatmap */}
            <p style={{ fontSize: 11, letterSpacing: 4, textTransform: "uppercase", color: ACCENT, margin: "32px 0 12px" }}>Spatial Heatmap</p>
            <GlassCard hover={false} style={{ padding: 0, overflow: "hidden", minHeight: 400, position: "relative" }}>
              <LakeHeatmap analysis={analysis} />
            </GlassCard>

            {/* Confidence Notes */}
            <div style={{
              marginTop: 32, padding: "16px 20px", borderRadius: 12,
              border: `1px solid rgba(255,214,0,0.15)`, background: "rgba(255,214,0,0.03)",
            }}>
              <p style={{ fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#FFD600", margin: "0 0 8px" }}>Confidence Notes</p>
              <p style={{ fontSize: 13, color: TEXT_SECONDARY, lineHeight: 1.7, margin: 0 }}>{analysis.confidence_notes}</p>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
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