import getTransform from "@/lib/getTransform";
import { LeafElement } from "@/types/editorElement.type";

interface RectangleProps {
  element: LeafElement;
}

export default function Rectangle({ element }: RectangleProps) {
  const safeWidth = Math.max(1, element.w || 0);
  const safeHeight = Math.max(1, element.h || 0);

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
        <rect
          x="0"
          y="0"
          width={safeWidth}
          height={safeHeight}
          rx={Math.max(0, element.rx ?? 0)}
          ry={Math.max(0, element.ry ?? element.rx ?? 0)}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}
