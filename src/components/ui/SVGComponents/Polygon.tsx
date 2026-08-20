import getTransform from "@/lib/getTransform";
import {LeafElement} from "@/types/editorElement.type";

interface PolygonProps {
  element: LeafElement;
}

export default function Polygon({ element }: PolygonProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <polygon
          points={element.points ?? "10,10 90,10 50,90"}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#8a909b"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}