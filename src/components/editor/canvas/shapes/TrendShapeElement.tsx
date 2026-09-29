"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Group, Rect, Line, Text, Circle } from "react-konva";
import { useShallow } from "zustand/react/shallow";
import { LeafElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { trendPens, trendScale, trendTiming } from "@/lib/editor/trendSettings";
import { buildTrendGeometry, formatTrendValue } from "@/lib/editor/trendGeometry";
import { useTrendStore } from "@/store/useTrendStore";
import type { TrendPoint } from "@/lib/runtime/archive";
import type { ShapeElementProps } from "../types";
import { SelectionOutline } from "./SelectionOutline";

const EMPTY_SERIES: Record<string, readonly TrendPoint[] | undefined> = {};

/**
 * Тренд: перья — тег-свойства элемента, оформление — `el.trend` (см. lib/editor/trendSettings.ts).
 *
 * В редакторе данных нет — рисуются оси, сетка и легенда. В мониторе серии приходят из
 * useTrendStore (история архива + живые точки), а окно `[now − window, now]` сдвигается
 * часами. Признак монитора — перья в `watched` стора: их ставит только движок монитора,
 * отдельный флаг через контекст рендера для этого не нужен.
 */
export function TrendShapeElement({ el, isSelected, onElementClick, updateElementVisual, stateId, runtime }: ShapeElementProps) {
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;
  const pad = 4;

  const w = rendered.w || 320;
  const h = rendered.h || 180;

  const bgColor = rendered.backgroundColor || "#1e293b";
  const strokeCol = rendered.strokeColor || "#475569";
  const textCol = rendered.textColor || "#94a3b8";
  const gridCol = rendered.gridColor || "#1e3a5f";
  const showGrid = rendered.showGrid !== false;
  const showDots = !!rendered.showDots;
  const showLegend = rendered.showLegend !== false;
  const title = (rendered.title as string) || "";

  // Перья и окно — из базы элемента (trend и properties от состояния не зависят).
  const pens = useMemo(() => trendPens(el), [el]);
  const { window: windowSec, step } = trendTiming(el.trend);
  // Общая шкала Y тренда (контракт 2026-09-29-trend-common-scale-contract.md). Примитивами —
  // для зависимостей мемо ниже: объект создавался бы заново на каждый рендер.
  const { min: scaleMin, max: scaleMax } = trendScale(el.trend);

  const live = useTrendStore(s => pens.some(p => s.watched.has(p.tag)));
  // Курсор воспроизведения архива: пока он задан, окно стоит на нём, а не на часах.
  const clockTs = useTrendStore(s => s.clockTs);
  const series = useTrendStore(useShallow(s => {
    if (!pens.length) return EMPTY_SERIES;
    const out: Record<string, readonly TrendPoint[] | undefined> = {};
    for (const p of pens) out[p.tag] = s.seriesByTag[p.tag];
    return out;
  }));

  // Часы окна: только в мониторе. Шаг — время, за которое окно сдвигается на пиксель, но
  // не чаще раза в секунду: чаще глаз не заметит, а тренд перерисовывается целиком.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live || clockTs !== null) return;
    setNow(Date.now());
    const tick = Math.max(1000, Math.round((windowSec * 1000) / Math.max(1, w)));
    const timer = setInterval(() => setNow(Date.now()), tick);
    return () => clearInterval(timer);
  }, [live, clockTs, windowSec, w]);

  // Отступы внутри графика
  const legendH = showLegend && pens.length ? 14 : 0;
  const marginL = 40;
  const marginB = 18;
  const marginT = (title ? 20 : 6) + legendH;
  const marginR = 10;
  const plot = { x: marginL, y: marginT, w: Math.max(1, w - marginL - marginR), h: Math.max(1, h - marginT - marginB) };

  const to = live ? (clockTs ?? now) : Date.now();
  const from = to - windowSec * 1000;
  const geometry = useMemo(
    () => buildTrendGeometry({
      pens, seriesByTag: live ? series : EMPTY_SERIES, from, to, stepSec: step, plot,
      scale: { min: scaleMin, max: scaleMax },
    }),
    // plot пересчитывается из примитивов ниже — объект в deps менялся бы каждый рендер.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pens, series, live, from, to, step, scaleMin, scaleMax, plot.x, plot.y, plot.w, plot.h],
  );

  // Легенда: цветной маркер, подпись и последнее значение пера (в мониторе).
  let legendX = marginL;
  const legend = showLegend ? geometry.pens.map((g, i) => {
    const pen = pens[i];
    const value = live && g.last !== null ? `: ${formatTrendValue(g.last)}` : "";
    const text = `${pen.label}${value}`;
    const x = legendX;
    legendX += 14 + text.length * 5.6 + 10;
    return (
      <Group key={`lg-${pen.name}`} x={x} y={(title ? 20 : 6)} listening={false}>
        <Rect x={0} y={2} width={8} height={8} fill={g.color} cornerRadius={1} />
        <Text x={12} y={0} text={text} fontSize={10} fill={textCol} />
      </Group>
    );
  }) : null;

  return (
    <Group
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragEnd={(e) => updateElementVisual(el.key, { x: e.target.x(), y: e.target.y() })}
      onClick={(e) => { e.cancelBubble = true; onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey); }}
    >
      {isSelected && (
        <SelectionOutline x={-pad} y={-pad} width={w + pad * 2} height={h + pad * 2} />
      )}

      {/* Фон */}
      <Rect x={0} y={0} width={w} height={h} fill={bgColor} cornerRadius={4} />

      {title ? (
        <Text x={marginL} y={4} width={plot.w} text={title} fontSize={11} fill={textCol} align="left" listening={false} />
      ) : null}

      {legend}

      {/* Сетка по тикам — те же линии, что подписи осей */}
      {showGrid && geometry.yTicks.map((t, i) => (
        <Line key={`gh-${i}`} points={[plot.x, t.y, plot.x + plot.w, t.y]} stroke={gridCol} strokeWidth={1} listening={false} />
      ))}
      {showGrid && geometry.xTicks.map((t, i) => (
        <Line key={`gv-${i}`} points={[t.x, plot.y, t.x, plot.y + plot.h]} stroke={gridCol} strokeWidth={1} listening={false} />
      ))}

      {/* Подписи осей: Y — по общей шкале тренда, одна ось на все перья */}
      {geometry.yTicks.map((t, i) => (
        <Text
          key={`yl-${i}`}
          x={0} y={t.y - 5}
          width={marginL - 4}
          text={t.label}
          fontSize={9}
          fill={textCol}
          align="right"
          listening={false}
        />
      ))}
      {geometry.xTicks.map((t, i) => (
        <Text key={`xl-${i}`} x={t.x - 20} y={plot.y + plot.h + 4} width={40} text={t.label} fontSize={9} fill={textCol} align="center" listening={false} />
      ))}

      {/* Перья: ступенька, разрыв на недостоверных значениях */}
      {geometry.pens.map(g => (
        <Group key={`pen-${g.name}`} listening={false}>
          {g.segments.map((pts, i) => (
            <Line key={i} points={pts} stroke={g.color} strokeWidth={g.width} lineCap="square" lineJoin="miter" listening={false} />
          ))}
          {showDots && g.dots.map((d, i) => (
            <Circle key={`d-${i}`} x={d.x} y={d.y} radius={2.5} fill={g.color} listening={false} />
          ))}
        </Group>
      ))}

      {!pens.length && (
        <Text
          x={plot.x} y={plot.y + plot.h / 2 - 6} width={plot.w}
          text="Нет перьев — добавьте их на вкладке «Свойства»"
          fontSize={10} fill={textCol} align="center" listening={false}
        />
      )}

      {/* Рамка области графика */}
      <Rect
        x={plot.x} y={plot.y} width={plot.w} height={plot.h}
        fill="transparent" stroke={strokeCol} strokeWidth={1} listening={false}
      />

      {/* Внешняя рамка */}
      <Rect x={0} y={0} width={w} height={h} fill="transparent" stroke={strokeCol} strokeWidth={1.5} cornerRadius={4} listening={false} />
    </Group>
  );
}
