import React from "react";
import {SCENE_PLAN_CANVAS, type ScenePlanElement} from "../../../types/assistant.types";

/**
 * Уменьшенная схема плана: холст 1920×1080, элементы — рамками с подписью.
 * Только картинка для оценки раскладки, а не отрисовка компонентов редактора.
 */
export function ScenePlanPreview({elements}: {elements: ScenePlanElement[]}) {
  const {width, height} = SCENE_PLAN_CANVAS;
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-lg border bg-muted"
      role="img"
      aria-label="Раскладка плана сцены"
    >
      {elements.map((el, i) => (
        <g key={i}>
          {el.type === "circle" ? (
            <ellipse
              cx={el.x + el.w / 2} cy={el.y + el.h / 2} rx={el.w / 2} ry={el.h / 2}
              className="fill-primary/10 stroke-primary" strokeWidth={3}
            />
          ) : (
            <rect
              x={el.x} y={el.y} width={el.w} height={el.h} rx={el.type === "button" ? 12 : 0}
              className={el.type === "group" ? "fill-none stroke-muted-foreground" : "fill-primary/10 stroke-primary"}
              strokeWidth={3}
              strokeDasharray={el.type === "group" ? "12 8" : undefined}
            />
          )}
          <text x={el.x + 8} y={el.y + 32} className="fill-foreground" fontSize={28}>
            {el.name || el.type}
          </text>
        </g>
      ))}
    </svg>
  );
}
