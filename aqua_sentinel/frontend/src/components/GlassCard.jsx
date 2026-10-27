import { useState } from "react";
import { GLASS, GLASS_BORDER } from "../utils/constants";

export default function GlassCard({ children, style = {}, glow, onClick, hover = true }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: GLASS,
        backdropFilter: "blur(24px) saturate(1.4)",
        WebkitBackdropFilter: "blur(24px) saturate(1.4)",
        border: `1px solid ${hovered && hover ? "rgba(0,229,255,0.2)" : GLASS_BORDER}`,
        borderRadius: 16,
        padding: "24px",
        transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        transform: hovered && hover ? "translateY(-2px)" : "none",
        boxShadow: glow ? `0 0 40px ${glow}15, inset 0 1px 0 rgba(255,255,255,0.05)` : "inset 0 1px 0 rgba(255,255,255,0.05)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
