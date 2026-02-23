import React from "react";

type ValveStatus = "open" | "closed" | "error";

interface ValveProps {
  size?: number;
  status?: ValveStatus;
  label?: string;
}

export const Valve: React.FC<ValveProps> = ({
                                              size = 80,
                                              status = "closed",
                                              label,
                                            }) => {
  const center = size / 2;
  const radius = size / 3;

  const getColor = () => {
    switch (status) {
      case "open":
        return "#16a34a"; // green
      case "closed":
        return "#0f172a"; // dark
      case "error":
        return "#dc2626"; // red
      default:
        return "#0f172a";
    }
  };

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Pipe */}
      <line
        x1="0"
        y1={center}
        x2={size}
        y2={center}
        stroke="#94a3b8"
        strokeWidth="6"
      />

      {/* Valve body */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="white"
        stroke={getColor()}
        strokeWidth="4"
      />

      {/* Valve cross */}
      <line
        x1={center - radius / 1.5}
        y1={center - radius / 1.5}
        x2={center + radius / 1.5}
        y2={center + radius / 1.5}
        stroke={getColor()}
        strokeWidth="3"
      />
      <line
        x1={center - radius / 1.5}
        y1={center + radius / 1.5}
        x2={center + radius / 1.5}
        y2={center - radius / 1.5}
        stroke={getColor()}
        strokeWidth="3"
      />

      {label && (
        <text
          x={center}
          y={size}
          textAnchor="middle"
          fontSize="14"
          fill="#bdbacf"
        >
          {label}
        </text>
      )}
    </svg>
  );
};