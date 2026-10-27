"use client";

import { useMemo } from "react";
import { Layer, Rect } from "react-konva";
import { GRID } from "@/core/scene";
import { createGridPattern } from "@/lib/editor/gridPattern";
import type { SheetSize } from "@/core/scene";
import type { ThemeColors } from "@/core/canvas";
import { gridStepForZoom } from "../lib/gridStep";

/**
 * Насколько «стол» выходит за края листа. Константа, а не доля от листа: лист
 * может быть маленьким, и `sheet.w * 3` оставил бы вокруг него голый Stage.
 */
const DESK_PAD = 20000;

interface BackgroundLayerProps {
  sheet: SheetSize;
  zoom: number;
  themeColors: ThemeColors;
  resolvedTheme: string | undefined;
}

/**
 * Слой фона: перерисовывается только при смене темы, размера листа и
 * шага сетки. В общем слое он переписывался бы заново на каждый кадр
 * перетаскивания и на каждое движение рамки выделения.
 * listening=false — большие прямоугольники уходят из hit-графа Konva;
 * клик по пустому месту приходит на сам Stage, и это уже учтено.
 *
 * Лист — подсказка, а не запрет: за его край можно выйти, поэтому
 * «стол» рисуется с большим запасом вокруг.
 */
export function BackgroundLayer({ sheet, zoom, themeColors, resolvedTheme }: BackgroundLayerProps) {
  const gridStep = useMemo(() => gridStepForZoom(zoom), [zoom]);

  const gridPattern = useMemo(
    () => gridStep === null
      ? null
      : createGridPattern(
        gridStep === GRID ? themeColors.gridLine : themeColors.gridLineMajor,
        gridStep,
      ),
    [gridStep, themeColors.gridLine, themeColors.gridLineMajor],
  );

  return (
    <Layer listening={false}>
      <Rect
        key={`desk-${resolvedTheme}`}
        name="desk-bg"
        x={-DESK_PAD}
        y={-DESK_PAD}
        width={sheet.w + DESK_PAD * 2}
        height={sheet.h + DESK_PAD * 2}
        fill={themeColors.deskBg}
      />
      <Rect
        key={`sheet-${resolvedTheme}`}
        name="sheet-bg"
        x={0}
        y={0}
        width={sheet.w}
        height={sheet.h}
        fill={themeColors.canvasBg}
        stroke={themeColors.sheetBorder}
        strokeWidth={1}
        // Толщина кромки — в экранных пикселях, БЕЗ деления на зум: иначе
        // проп менялся бы на каждый тик колеса и слой фона перерисовывался
        // бы вместе с ним. Тени у листа нет по той же причине (и потому что
        // тень на прямоугольнике в 21520 единиц дорога сама по себе).
        strokeScaleEnabled={false}
      />
      {gridPattern && (
        <Rect
          key={`grid-${resolvedTheme}-${gridStep}`}
          name="grid-bg"
          x={0}
          y={0}
          width={sheet.w}
          height={sheet.h}
          fillPriority="pattern"
          fillPatternImage={gridPattern as unknown as HTMLImageElement}
        />
      )}
    </Layer>
  );
}
