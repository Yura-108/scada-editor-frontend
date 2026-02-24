import getTransform from "@/lib/getTransform";

interface LineProps {
  element: BaseElement;
}

export default function Line({ element }: LineProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 3}
          strokeDasharray={element.strokeDasharray ?? ""}
        />

        {element.arrowEnd && (
          <polygon
            points="95,45 100,50 95,55"
            fill={element.strokeColor ?? "#9ca3af"}
          />
        )}
      </g>
    </svg>
  );
}