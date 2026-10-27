import { useState, useEffect, useCallback } from "react";
import GlassCard from "./GlassCard";
import ScoreRing from "./ScoreRing";
import WaterLoader from "./WaterLoader";
import LakeHeatmap from "./LakeHeatmap";
import { getApiBaseUrl } from "../utils/api";
import {
  ACCENT,
  ACCENT2,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  TEXT_MUTED,
} from "../utils/constants";

export default function SnapshotReportView() {
  const [snapshot, setSnapshot] = useState(null);
  const [windowMins, setWindowMins] = useState(60);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  // AI Report Generation from Live Snapshot
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);

  const fetchSnapshot = useCallback(async (mins = windowMins) => {
    const baseUrl = getApiBaseUrl();
    setIsLoading(true);
    try {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/snapshot?window_minutes=${mins}&limit=100`,
      );
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.error("Failed to load snapshot:", err);
    } finally {
      setIsLoading(false);
    }
  }, [windowMins]);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      const baseUrl = getApiBaseUrl();
      try {
        const res = await fetch(
          `${baseUrl}/api/v1/telemetry/snapshot?window_minutes=${windowMins}&limit=100`,
        );
        if (res.ok && !ignore) {
          const data = await res.json();
          setSnapshot(data);
        }
      } catch (err) {
        console.error("Failed to load snapshot:", err);
      }
    };
    run();
    return () => {
      ignore = true;
    };
  }, [windowMins]);

  const handleGenerateAiReport = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    const baseUrl = getApiBaseUrl();
    try {
      const res = await fetch(
        `${baseUrl}/api/v1/telemetry/analyze-live?limit=35`,
        {
          method: "POST",
        },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setAiReport(data);
    } catch (err) {
      console.error("AI Report generation failed:", err);
      setAnalysisError(
        err.message ||
          "Could not generate AI report. Check your OPENAI_API_KEY in backend.",
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyJson = () => {
    if (!snapshot) return;
    navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{ maxWidth: 1150, margin: "0 auto", padding: "24px 20px 80px" }}
    >
      {/* ── Top Header & Window Selectors ── */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 28,
          background: "rgba(10,22,40,0.6)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          padding: "18px 24px",
        }}
      >
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: ACCENT,
              margin: "0 0 4px",
            }}
          >
            CRM & Report Generation Gateway
          </p>
          <h2 style={{ fontSize: 20, fontWeight: 400, margin: 0 }}>
            Time-Series Telemetry Snapshot
          </h2>
        </div>

        {/* Window Selector & Action Buttons */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              background: "rgba(255,255,255,0.05)",
              borderRadius: 8,
              padding: 3,
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {[15, 30, 60, 180].map((m) => (
              <button
                key={m}
                onClick={() => setWindowMins(m)}
                style={{
                  background: windowMins === m ? ACCENT : "transparent",
                  color: windowMins === m ? "#0A1628" : TEXT_SECONDARY,
                  fontWeight: windowMins === m ? 600 : 400,
                  border: "none",
                  borderRadius: 6,
                  padding: "6px 12px",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {m < 60 ? `${m}m` : `${m / 60}h`}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchSnapshot()}
            disabled={isLoading}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: TEXT_PRIMARY,
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {isLoading ? "Refreshing..." : "↻ Refresh"}
          </button>

          <button
            onClick={handleCopyJson}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${copied ? "#00E676" : "rgba(255,255,255,0.12)"}`,
              color: copied ? "#00E676" : TEXT_PRIMARY,
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            {copied ? "✓ Copied JSON!" : "📋 Copy CRM Payload"}
          </button>

          <button
            onClick={handleGenerateAiReport}
            disabled={isAnalyzing}
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT2})`,
              border: "none",
              color: "#0A1628",
              padding: "8px 18px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: `0 2px 14px ${ACCENT}30`,
            }}
          >
            {isAnalyzing ? "Analyzing with GPT-4o..." : "✨ Generate AI Report"}
          </button>
        </div>
      </div>

      {/* ── AI Loading State ── */}
      {isAnalyzing && (
        <div
          style={{
            margin: "40px 0",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <WaterLoader text="GPT-4o Limnologist analyzing live Dal Lake telemetry snapshot..." />
        </div>
      )}

      {/* ── AI Analysis Error Banner ── */}
      {analysisError && (
        <div
          style={{
            marginBottom: 24,
            padding: "16px 20px",
            borderRadius: 12,
            background: "rgba(255,23,68,0.1)",
            border: "1px solid rgba(255,23,68,0.3)",
            color: "#FF6E6E",
            fontSize: 13,
          }}
        >
          <strong>Analysis Notice:</strong> {analysisError}
        </div>
      )}

      {/* ── Generated AI Report Section (If Ready) ── */}
      {aiReport && !isAnalyzing && (
        <div
          style={{
            marginBottom: 48,
            border: `1px solid ${ACCENT}40`,
            borderRadius: 16,
            padding: "28px 24px",
            background: "rgba(0,229,255,0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div>
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: ACCENT,
                }}
              >
                Live Stream AI Intelligence Report
              </span>
              <h2
                style={{ fontSize: 26, fontWeight: 300, margin: "4px 0 6px" }}
              >
                {aiReport.report_title}
              </h2>
              <p
                style={{
                  color: TEXT_MUTED,
                  fontSize: 13,
                  margin: 0,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {aiReport.location?.name} &bull; Generated from live Heltech
                telemetry buffer
              </p>
            </div>
            <button
              onClick={() => setAiReport(null)}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.15)",
                color: TEXT_SECONDARY,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              ✕ Close Report
            </button>
          </div>

          {/* WQI & Executive Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "200px 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            <GlassCard
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
              }}
              glow={ACCENT}
            >
              <ScoreRing
                score={aiReport.overall_water_quality_index?.score || 70}
                label={aiReport.overall_water_quality_index?.category}
              />
            </GlassCard>
            <GlassCard hover={false}>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: ACCENT,
                  margin: "0 0 10px",
                }}
              >
                Executive Summary
              </p>
              <p
                style={{
                  fontSize: 14,
                  lineHeight: 1.8,
                  color: TEXT_SECONDARY,
                  margin: 0,
                }}
              >
                {aiReport.overall_water_quality_index?.summary}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  marginTop: 14,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 4,
                    background: "rgba(0,230,118,0.1)",
                    color: "#00E676",
                  }}
                >
                  {aiReport.regulatory_compliance_summary?.overall_compliance}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 4,
                    background: "rgba(255,214,0,0.1)",
                    color: "#FFD600",
                  }}
                >
                  Trophic: {aiReport.ecological_assessment?.trophic_state}
                </span>
              </div>
            </GlassCard>
          </div>

          {/* Spatial Heatmap if returned by AI */}
          {aiReport.spatial_heatmap && aiReport.spatial_heatmap.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                  color: ACCENT,
                  margin: "0 0 12px",
                }}
              >
                AI-Inferred Spatial Risk Heatmap
              </p>
              <GlassCard
                hover={false}
                style={{ padding: 0, overflow: "hidden", minHeight: 350 }}
              >
                <LakeHeatmap analysis={aiReport} />
              </GlassCard>
            </div>
          )}
        </div>
      )}

      {/* ── CRM Executive Summary & Statistics ── */}
      {snapshot && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "260px 1fr",
              gap: 20,
              marginBottom: 24,
            }}
          >
            {/* Left: CRM Compliance Card */}
            <GlassCard style={{ padding: 24, textAlign: "center" }}>
              <p
                style={{
                  fontSize: 11,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: ACCENT,
                  margin: "0 0 16px",
                }}
              >
                Average WQI (Window)
              </p>
              <ScoreRing
                score={snapshot.crm_summary?.average_wqi || 75}
                size={140}
                label={snapshot.crm_summary?.compliance_category}
              />

              <div
                style={{
                  marginTop: 20,
                  textAlign: "left",
                  fontSize: 12,
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: TEXT_MUTED }}>Total Samples:</span>
                  <span style={{ fontWeight: 600 }}>
                    {snapshot.metadata?.total_readings}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#00E676" }}>Normal Points:</span>
                  <span style={{ fontWeight: 600 }}>
                    {snapshot.crm_summary?.status_breakdown?.normal_points}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span style={{ color: "#FFD600" }}>Caution Points:</span>
                  <span style={{ fontWeight: 600 }}>
                    {snapshot.crm_summary?.status_breakdown?.caution_points}
                  </span>
                </div>
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span style={{ color: "#FF6E6E" }}>Critical Points:</span>
                  <span style={{ fontWeight: 600 }}>
                    {snapshot.crm_summary?.status_breakdown?.critical_points}
                  </span>
                </div>
              </div>
            </GlassCard>

            {/* Right: Statistical Parameters Summary Table */}
            <GlassCard hover={false} style={{ padding: "20px 24px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    color: ACCENT,
                    margin: 0,
                  }}
                >
                  Time-Series Statistical Aggregates
                </p>
                <span style={{ fontSize: 11, color: TEXT_MUTED }}>
                  Time Window: Last {windowMins} Minutes
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 13,
                    textAlign: "left",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.08)",
                        color: TEXT_MUTED,
                        fontSize: 11,
                        textTransform: "uppercase",
                      }}
                    >
                      <th style={{ padding: "8px 12px" }}>Parameter</th>
                      <th style={{ padding: "8px 12px" }}>Min</th>
                      <th style={{ padding: "8px 12px" }}>Mean</th>
                      <th style={{ padding: "8px 12px" }}>Max</th>
                      <th style={{ padding: "8px 12px" }}>Std Dev (σ)</th>
                      <th style={{ padding: "8px 12px" }}>Standard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "ph", name: "pH (Sensor)", unit: "pH", std: "6.5–8.5" },
                      {
                        key: "turbidity",
                        name: "Turbidity (Sensor)",
                        unit: "NTU",
                        std: "≤ 5.0 NTU",
                      },
                      {
                        key: "tds",
                        name: "Total Dissolved Solids (Sensor)",
                        unit: "ppm",
                        std: "≤ 300 ppm",
                      },
                      {
                        key: "temperature",
                        name: "Temperature (Mocked)",
                        unit: "°C",
                        std: "10–22 °C",
                      },
                      {
                        key: "conductivity",
                        name: "Conductivity (Derived)",
                        unit: "µS/cm",
                        std: "≤ 350 µS/cm",
                      },
                    ].map((row) => {
                      const stat = snapshot.statistics?.[row.key] || {
                        min: 0,
                        max: 0,
                        mean: 0,
                        std_dev: 0,
                      };
                      return (
                        <tr
                          key={row.key}
                          style={{
                            borderBottom: "1px solid rgba(255,255,255,0.03)",
                          }}
                        >
                          <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                            {row.name}{" "}
                            {row.unit && (
                              <span style={{ color: TEXT_MUTED, fontSize: 11 }}>
                                ({row.unit})
                              </span>
                            )}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {stat.min}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "'JetBrains Mono', monospace",
                              color: ACCENT,
                            }}
                          >
                            {stat.mean}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {stat.max}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontFamily: "'JetBrains Mono', monospace",
                              color: TEXT_MUTED,
                            }}
                          >
                            {stat.std_dev}
                          </td>
                          <td
                            style={{
                              padding: "10px 12px",
                              fontSize: 11,
                              color: TEXT_SECONDARY,
                            }}
                          >
                            {row.std}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>

          {/* ── Toggle Raw JSON Preview for CRM Developers ── */}
          <div style={{ marginTop: 24 }}>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              style={{
                background: "transparent",
                border: "none",
                color: TEXT_MUTED,
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span>
                {showRawJson
                  ? "▼ Hide CRM API Payload"
                  : "▶ View Raw CRM JSON Payload"}
              </span>
            </button>

            {showRawJson && (
              <pre
                style={{
                  marginTop: 12,
                  padding: "16px",
                  borderRadius: "10px",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  fontSize: "11px",
                  fontFamily: "'JetBrains Mono', monospace",
                  color: "#00E5FF",
                  maxHeight: "350px",
                  overflowY: "auto",
                }}
              >
                {JSON.stringify(snapshot, null, 2)}
              </pre>
            )}
          </div>
        </>
      )}
    </div>
  );
}
