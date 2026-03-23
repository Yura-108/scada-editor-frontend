import getTransform from "@/lib/getTransform";
import {LeafElement} from "@/types/editorElement.type";
import {useEditorStore} from "@/store/useEditorStore";

interface CircleProps {
  element: LeafElement;
}

export default function Circle({ element }: CircleProps) {
  const padding = 2;
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
        <ellipse
          cx={element.w / 2}
          cy={element.h / 2}
          rx={element.w / 2 - padding}
          ry={element.h / 2 - padding}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}