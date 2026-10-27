import { useState, useEffect } from "react";
import { TEXT_PRIMARY, TEXT_SECONDARY } from "../utils/constants";

export default function ScoreRing({ score = 0, size = 180, label }) {
  const [animScore, setAnimScore] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = () => {
      start += (score - start) * 0.05;
      if (Math.abs(score - start) < 0.5) { setAnimScore(score); return; }
      setAnimScore(Math.round(start));
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [score]);
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * animScore) / 100;
  const color = score >= 70 ? "#00E676" : score >= 40 ? "#FFD600" : "#FF1744";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.16, 1, 0.3, 1)", filter: `drop-shadow(0 0 12px ${color}60)` }}
        />
        <text x={size / 2} y={size / 2 + 14} textAnchor="middle" fill={TEXT_PRIMARY}
          fontSize="42" fontWeight="300" fontFamily="'Outfit', sans-serif"
          style={{ transform: "rotate(90deg)", transformOrigin: "center" }}>
          {animScore}
        </text>
      </svg>
      {label && <span style={{ fontSize: 13, color: TEXT_SECONDARY, letterSpacing: 2, textTransform: "uppercase" }}>{label}</span>}
    </div>
  );
}
