import getTransform from "@/lib/getTransform";

interface PathProps {
  element: BaseElement;
}

export default function Path({ element }: PathProps) {
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
      <g
        transform={getTransform(element)}
        opacity={element.opacity ?? 1}
      >
        <path
          d={element.d ?? "M10 50 Q50 10 90 50 T90 90"}
          fill={element.bg ?? "none"}
          stroke={element.strokeColor ?? "#9ca3af"}
          strokeWidth={element.strokeWidth ?? 2}
          strokeDasharray={element.strokeDasharray ?? ""}
        />
      </g>
    </svg>
  );
}