import getTransform from "@/lib/getTransform";

interface CircleProps {
  element: BaseElement;
}

export default function Circle({ element }: CircleProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <ellipse
          cx="50"
          cy="50"
          rx={element.rx ?? 40}
          ry={element.ry ?? 40}
          fill={element.bg ?? "#4b5563"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
        />
      </g>
    </svg>
  );
}