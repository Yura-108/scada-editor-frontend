import getTransform from "@/lib/getTransform";
import { LeafElement } from "@/types/editorElement.type";

interface RectangleProps {
  element: LeafElement;
}

export default function Rectangle({ element }: RectangleProps) {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${element.w} ${element.h}`}
      preserveAspectRatio="none"
    >
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <rect
          x="0"
          y="0"
          width={element.w}
          height={element.h}
          rx={element.rx ?? 0}
          ry={element.ry ?? 0}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}
