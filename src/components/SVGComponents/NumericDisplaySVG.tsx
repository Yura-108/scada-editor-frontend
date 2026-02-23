import React from "react";

interface NumericDisplayProps {
  value: number | string;
  unit?: string;
  width?: number;
  height?: number;
  precision?: number;
}

export const NumericDisplay: React.FC<NumericDisplayProps> = ({
  value,
  unit,
  width = 120,
  height = 60,
  precision = 2
}) => {
  const formattedValue = typeof value === "number" ? value.toFixed(precision) : value;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background */}
      <rect
        x="0"
        y="0"
        width={width}
        height={height}
        rx="8"
        fill="#0f172a"
      />

      {/* Value */}
      <text
        x={width / 2}
        y={height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={height / 3}
        fill="#22d3ee"
        fontFamily="monospace"
      >
        {formattedValue}
      </text>

      {/* Unit */}
      {unit && (
        <text
          x={width - 8}
          y={height - 6}
          textAnchor="end"
          fontSize="12"
          fill="#94a3b8"
        >
          {unit}
        </text>
      )}
    </svg>
  );
};