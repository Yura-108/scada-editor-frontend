import getTransform from "@/lib/getTransform";
import {LeafElement} from "@/types/editorElement.type";

interface CircleProps {
  element: LeafElement;
}

export default function Circle({ element }: CircleProps) {
  const padding = 2;
  const safeWidth = Math.max(1, element.w || 0);
  const safeHeight = Math.max(1, element.h || 0);
  const rx = Math.max(0, safeWidth / 2 - padding);
  const ry = Math.max(0, safeHeight / 2 - padding);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      preserveAspectRatio="none"
    >
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <ellipse
          cx={safeWidth / 2}
          cy={safeHeight / 2}
          rx={rx}
          ry={ry}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}