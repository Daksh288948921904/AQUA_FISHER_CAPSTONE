export default function StatusDot({ status }) {
  const colors = { Normal: "#00E676", Caution: "#FFD600", Critical: "#FF1744" };
  const c = colors[status] || colors.Normal;
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: c, boxShadow: `0 0 8px ${c}80`, marginRight: 8, flexShrink: 0,
    }} />
  );
}
