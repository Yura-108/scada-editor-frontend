export function ButtonSVG({ color = "#FF4D4F", size = 50 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50">
      {/* Основа кнопки */}
      <rect x="5" y="20" width="40" height="15" rx="3" fill={color} stroke="#333" strokeWidth="2" />
      {/* Тень */}
      <rect x="5" y="22" width="40" height="2" fill="#222" opacity="0.3" />
      {/* Метка */}
      <text x="25" y="32" textAnchor="middle" fill="#fff" fontSize="10" fontFamily="Arial">Btn</text>
    </svg>
  );
}