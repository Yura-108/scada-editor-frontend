export function LampSVG({ color = "#FFD700", size = 40 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      {/* Корпус лампы */}
      <circle cx="20" cy="20" r="12" fill={color} stroke="#333" strokeWidth="2" />
      {/* База */}
      <rect x="16" y="28" width="8" height="4" fill="#555" />
      {/* Светящийся эффект */}
      <circle cx="20" cy="20" r="12" fill="url(#glow)" opacity="0.3" />
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}