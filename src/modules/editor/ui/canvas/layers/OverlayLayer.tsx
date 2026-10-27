"use client";

import type { RefObject } from "react";
import type Konva from "konva";
import { Layer, Line, Rect } from "react-konva";
import type { DiagramElement } from "@/types/editorElement.type";
import type {MonitorView, SheetSize} from "@/core/scene";
import type { SelectionRect, ThemeColors } from "@/components/editor/canvas/types";
import type { HoverHighlight } from "@/components/editor/canvas/hooks/useHoverHighlight";
import { NoDataOverlay } from "@/components/editor/canvas/shapes/NoDataOverlay";
import { SelectionTransformer } from "@/components/editor/canvas/shapes/SelectionTransformer";
import { HoverHighlightShape } from "./HoverHighlightShape";

interface OverlayLayerProps {
  readOnly: boolean;
  themeColors: ThemeColors;
  zoom: number;
  sheet: SheetSize;
  monitorView: MonitorView | null;
  noDataElementKeys: Set<string>;
  elements: DiagramElement[];
  elementsMap: Record<string, DiagramElement>;
  hoverHighlight: HoverHighlight | null;
  selectionRect: SelectionRect | null;
  guides: { v: number | null; h: number | null };
  transformTarget: DiagramElement | null;
  stageRef: RefObject<Konva.Stage | null>;
  updateElementVisual: (key: string, props: Record<string, unknown>) => void;
}

/**
 * Слой оверлеев: подсветка, направляющие, рамка выделения, Transformer.
 * Живёт отдельно, чтобы движение мыши при протяжке рамки или
 * перетаскивании перерисовывало только его, а не всю сцену.
 */
export function OverlayLayer({
  readOnly, themeColors, zoom, sheet, monitorView, noDataElementKeys, elements, elementsMap,
  hoverHighlight, selectionRect, guides, transformTarget, stageRef, updateElementVisual,
}: OverlayLayerProps) {
  return (
    <Layer listening={!readOnly}>
      {/* Рамка вида для монитора — только в редакторе: инженер видит, что именно
          зафиксировал. Ширина — точно то, что монитор впишет во всю ширину экрана;
          высота — сколько было видно у инженера (в мониторе по вертикали прокручивают). */}
      {!readOnly && monitorView && (
        <Rect
          name="monitor-view-frame"
          x={monitorView.x}
          y={monitorView.y}
          width={monitorView.w}
          height={monitorView.h}
          stroke={themeColors.selection}
          strokeWidth={2}
          dash={[10, 6]}
          strokeScaleEnabled={false}
          listening={false}
        />
      )}

      {/* «Нет данных» (монитор, docs/contract/TAG_CONTRACT_CHANGES.md B2/B4): пустой набор
          вне монитора — движок рантайма там не запущен. */}
      <NoDataOverlay noDataElementKeys={noDataElementKeys} elements={elements} elementsMap={elementsMap} />

      {hoverHighlight && !selectionRect && (
        <HoverHighlightShape highlight={hoverHighlight} color={themeColors.selection} />
      )}

      {/* Smart-guides: линии привязки к соседям во время перетаскивания.
          Тянутся за пределы листа — выравнивать можно и то, что за его краем. */}
      {guides.v !== null && (
        <Line
          points={[guides.v, -sheet.h, guides.v, sheet.h * 2]}
          stroke={themeColors.guide}
          strokeWidth={1 / zoom}
          dash={[4, 4]}
          listening={false}
        />
      )}
      {guides.h !== null && (
        <Line
          points={[-sheet.w, guides.h, sheet.w * 2, guides.h]}
          stroke={themeColors.guide}
          strokeWidth={1 / zoom}
          dash={[4, 4]}
          listening={false}
        />
      )}

      {/* Transformer: 8 ручек + поворот для одиночного бокс-элемента */}
      {transformTarget && !readOnly && (
        <SelectionTransformer
          element={transformTarget}
          stageRef={stageRef}
          updateElementVisual={updateElementVisual}
          zoom={zoom}
        />
      )}

      {selectionRect && (
        <Rect
          x={Math.min(selectionRect.x, selectionRect.x + selectionRect.width)}
          y={Math.min(selectionRect.y, selectionRect.y + selectionRect.height)}
          width={Math.abs(selectionRect.width)}
          height={Math.abs(selectionRect.height)}
          fill={themeColors.selectionFill}
          stroke={themeColors.selection}
          strokeWidth={1}
          listening={false}
        />
      )}
    </Layer>
  );
}
