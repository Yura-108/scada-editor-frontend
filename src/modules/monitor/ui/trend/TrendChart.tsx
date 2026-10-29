import React, {useState, type RefObject} from "react";
import {formatTrendValue, type buildTrendGeometry, type trendPens} from "@/core/scene";
import type {TrendPoint} from "../../model/archive/archive";
import {formatDateTime, valueAt} from "../../lib/trendTime";

type Geometry = ReturnType<typeof buildTrendGeometry>;
type Pen = ReturnType<typeof trendPens>[number];

/** График тренда (SVG в пикселях контейнера) и подсказка с временем и значениями перьев под курсором. */
export function TrendChart({boxRef, size, plot, geometry, from, to, visiblePens, seriesByTag, hasPens}: {
  boxRef: RefObject<HTMLDivElement | null>;
  size: {w: number; h: number};
  plot: {x: number; y: number; w: number; h: number};
  geometry: Geometry;
  from: number;
  to: number;
  visiblePens: Pen[];
  seriesByTag: Record<string, TrendPoint[]>;
  hasPens: boolean;
}) {
  // Курсор: время и значения всех перьев под ним.
  const [hoverX, setHoverX] = useState<number | null>(null);
  const hoverTs = hoverX === null ? null : from + ((hoverX - plot.x) / plot.w) * (to - from);

  return (
    <div ref={boxRef} className="relative flex-1 min-h-[240px] rounded-lg bg-slate-900">
      <svg
        width={size.w}
        height={size.h}
        className="absolute inset-0 select-none"
        onMouseMove={e => {
          const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
          setHoverX(x >= plot.x && x <= plot.x + plot.w ? x : null);
        }}
        onMouseLeave={() => setHoverX(null)}
      >
        {geometry.yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={plot.x} x2={plot.x + plot.w} y1={t.y} y2={t.y} stroke="#1e3a5f" />
            <text x={plot.x - 6} y={t.y + 3} textAnchor="end" fontSize={11}
              fill="#94a3b8">
              {t.label}
            </text>
          </g>
        ))}
        {geometry.xTicks.map((t, i) => (
          <g key={`x-${i}`}>
            <line x1={t.x} x2={t.x} y1={plot.y} y2={plot.y + plot.h} stroke="#1e3a5f" />
            <text x={t.x} y={plot.y + plot.h + 16} textAnchor="middle" fontSize={11} fill="#94a3b8">{t.label}</text>
          </g>
        ))}
        {geometry.pens.map(g => g.segments.map((pts, i) => (
          <polyline
            key={`${g.name}-${i}`}
            points={pts.join(" ")}
            fill="none"
            stroke={g.color}
            strokeWidth={g.width}
            strokeLinejoin="miter"
          />
        )))}
        <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} fill="none" stroke="#475569" />
        {hoverX !== null && (
          <line x1={hoverX} x2={hoverX} y1={plot.y} y2={plot.y + plot.h} stroke="#e2e8f0" strokeDasharray="3 3" />
        )}
      </svg>

      {hoverX !== null && hoverTs !== null && (
        <div
          className="pointer-events-none absolute top-2 rounded-md bg-neutral-900/90 px-2 py-1.5 text-xs text-gray-100 shadow"
          style={hoverX > size.w / 2 ? {right: size.w - hoverX + 8} : {left: hoverX + 8}}
        >
          <div className="mb-1 text-gray-400">{formatDateTime(hoverTs)}</div>
          {visiblePens.map(pen => {
            // Как на графике и в легенде — с коэффициентом пера.
            const raw = valueAt(seriesByTag[pen.tag] ?? [], hoverTs);
            const v = raw == null ? raw : raw * pen.k + pen.b;
            return (
              <div key={pen.name} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{background: pen.color}} />
                {pen.label}: {v === undefined ? "—" : v === null ? "нет связи" : formatTrendValue(v)}
              </div>
            );
          })}
        </div>
      )}

      {!hasPens && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
          У тренда нет перьев
        </div>
      )}
    </div>
  );
}
