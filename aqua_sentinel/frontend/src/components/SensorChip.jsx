import { useState } from "react";
import { ACCENT, TEXT_MUTED, GLASS_BORDER, GLASS } from "../utils/constants";

export default function SensorChip({ label }) {
  const [hovered, setHovered] = useState(false);
  return (
    <span
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase",
        padding: "6px 14px", borderRadius: 20,
        border: `1px solid ${hovered ? ACCENT : GLASS_BORDER}`,
        background: hovered ? `${ACCENT}12` : GLASS,
        color: hovered ? ACCENT : TEXT_MUTED,
        transition: "all 0.25s ease",
        cursor: "default",
        boxShadow: hovered ? `0 0 12px ${ACCENT}25` : "none",
      }}
    >
      {label}
    </span>
  );
}
