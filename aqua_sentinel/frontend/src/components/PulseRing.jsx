import { ACCENT } from "../utils/constants";

export default function PulseRing({ size = 200, color = ACCENT }) {
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          border: `1px solid ${color}`,
          opacity: 0.3 - i * 0.08,
          animation: `pulse-ring 3s ease-out ${i * 0.8}s infinite`,
        }} />
      ))}
      <style>{`@keyframes pulse-ring { 0% { transform: scale(0.8); opacity: 0.4; } 100% { transform: scale(1.6); opacity: 0; } }`}</style>
    </div>
  );
}
