import { ACCENT, TEXT_PRIMARY, TEXT_MUTED } from "../utils/constants";

export default function WaterLoader({ text = "Analyzing..." }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: "80px 0" }}>
      <div style={{ position: "relative", width: 120, height: 120 }}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `1.5px solid ${ACCENT}`,
            animation: `water-ripple 2.4s ease-out ${i * 0.5}s infinite`,
          }} />
        ))}
        <div style={{
          position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
          width: 8, height: 8, borderRadius: "50%", background: ACCENT,
          boxShadow: `0 0 20px ${ACCENT}80, 0 0 60px ${ACCENT}30`,
        }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <p style={{ color: TEXT_PRIMARY, fontSize: 18, fontWeight: 300, margin: 0, letterSpacing: 1 }}>{text}</p>
        <p style={{ color: TEXT_MUTED, fontSize: 13, margin: "8px 0 0", letterSpacing: 3, textTransform: "uppercase" }}>
          Processing sensor data
        </p>
      </div>
      <style>{`@keyframes water-ripple { 0% { transform: scale(0.3); opacity: 0.8; } 100% { transform: scale(1.5); opacity: 0; } }`}</style>
    </div>
  );
}
