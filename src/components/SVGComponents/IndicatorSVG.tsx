export function IndicatorSVG({ color = "#00FF00", size = 30 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30">
      {/* Корпус */}
      <circle cx="15" cy="15" r="12" fill="#222" stroke="#333" strokeWidth="2" />
      {/* Светящийся индикатор */}
      <circle cx="15" cy="15" r="6" fill={color} stroke="#000" strokeWidth="1" />
      {/* Внутренний свет */}
      <circle cx="15" cy="15" r="6" fill="url(#grad)" opacity="0.4" />
      <defs>
        <radialGradient id="grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={color} stopOpacity="0.8" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
    </svg>
  );
}