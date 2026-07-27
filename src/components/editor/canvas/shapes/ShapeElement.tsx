"use client";

import React from "react";
import { Group, Rect, Circle, Line, Text, Arrow } from "react-konva";
import Konva from "konva";
import { DiagramElement, LeafElement } from "@/types/editorElement.type";
import { getRenderedElement } from "@/lib/getRenderedElement";
import { EditorRenderContext } from "../types";
import { Anchor } from "./Anchor";
import { CircleResizeHandle } from "./CircleResizeHandle";
import { TextShapeElement } from "./TextShapeElement";
import { CheckboxShapeElement } from "./CheckboxShapeElement";
import { ProgressBarShapeElement } from "./ProgressBarShapeElement";
import { ButtonShapeElement } from "./ButtonShapeElement";
import { ToggleShapeElement } from "./ToggleShapeElement";
import { SliderShapeElement } from "./SliderShapeElement";
import { DropdownShapeElement } from "./DropdownShapeElement";
import { InputShapeElement } from "./InputShapeElement";
import { ImageShapeElement } from "./ImageShapeElement";
import { GaugeShapeElement } from "./GaugeShapeElement";
import { TableShapeElement } from "./TableShapeElement";
import { TrendShapeElement } from "./TrendShapeElement";
import { ChartShapeElement } from "./ChartShapeElement";

interface ShapeElementProps {
  el: DiagramElement;
  ctx: EditorRenderContext;
}

/** Рендерит листовой элемент холста (polygon/circle/line/text/checkbox/progress_bar/rect). */
function ShapeElementBase({ el, ctx }: ShapeElementProps) {
  const { snap, updateElementVisual, onElementClick, closeMenu, themeColors } = ctx;
  // Когда к элементу прицеплен Transformer, его рамка заменяет собственную
  // пунктирную рамку фигуры (двойная рамка выглядит грязно).
  const isSelected = ctx.selectedIds.includes(el.key) && el.key !== ctx.transformerKey;
  const rendered = getRenderedElement(el) as LeafElement;

  if (rendered.type === "polygon") {
    let pts: number[] = [];
    const pointsData = rendered.points as string | number[] | undefined;

    if (typeof pointsData === "string") {
      try { pts = JSON.parse(pointsData); } catch { pts = []; }
    } else if (Array.isArray(pointsData)) {
      pts = pointsData;
    }

    const expectedLen = (rendered.sides || 3) * 2;
    if (pts.length !== expectedLen) {
      const sides = rendered.sides || 3;
      const radius = rendered.radius || 40;

      const cx = rendered.w / 2;
      const cy = rendered.h / 2;

      pts = [];
      for (let i = 0; i < sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        pts.push(cx + radius * Math.cos(angle));
        pts.push(cy + radius * Math.sin(angle));
      }
    }

    return (
      <Group key={el.key} id={el.key} x={rendered.x} y={rendered.y}>
        <Line
          points={pts as number[]}
          closed={true}
          fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
          stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
          strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
          draggable
          onDragEnd={(e) => {
            const node = e.target;
            const dx = node.x();
            const dy = node.y();
            node.position({ x: 0, y: 0 });
            updateElementVisual(el.key, {
              x: snap(rendered.x + dx),
              y: snap(rendered.y + dy),
            });
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            closeMenu();
            onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
          }}
        />
        {isSelected && (pts as number[]).map((p, i) => {
          if (i % 2 !== 0) return null; // skip y
          return (
            <Anchor
              key={`${el.key}-anc-${i}`}
              x={p}
              y={(pts as number[])[i + 1]}
              themeColors={themeColors}
              onDragMove={(e) => {
                const sx = snap(e.target.x());
                const sy = snap(e.target.y());
                e.target.position({ x: sx, y: sy });
                // Пишем в стор только при пересечении шага сетки.
                if (sx !== (pts as number[])[i] || sy !== (pts as number[])[i + 1]) {
                  const cp = [...(pts as number[])];
                  cp[i] = sx;
                  cp[i + 1] = sy;
                  updateElementVisual(el.key, { points: cp });
                }
              }}
            />
          );
        })}
      </Group>
    );
  }

  if (rendered.type === "circle") {
    const r = rendered.radius || rendered.w / 2 || 40;
    const cx = rendered.x + r;
    const cy = rendered.y + r;
    const circleRef = React.createRef<Konva.Circle>();
    return (
      <Group key={el.key} id={el.key}>
        <Circle
          ref={circleRef}
          x={cx}
          y={cy}
          radius={r}
          fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
          stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
          strokeWidth={isSelected ? 3 : (rendered.strokeWidth || 2)}
          draggable
          onDragEnd={(e) => {
            const nx = e.target.x();
            const ny = e.target.y();
            const dx = nx - cx;
            const dy = ny - cy;
            e.target.position({ x: cx, y: cy });
            updateElementVisual(el.key, { x: snap(rendered.x + dx), y: snap(rendered.y + dy) });
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
          }}
        />
        {isSelected && (
          <CircleResizeHandle
            key={`${el.key}-resize`}
            cx={cx}
            cy={cy}
            r={r}
            elKey={el.key}
            snap={snap}
            updateElementVisual={updateElementVisual}
            circleRef={circleRef}
          />
        )}
      </Group>
    );
  }

  if (rendered.type === "line") {
    const x1 = rendered.x1 ?? rendered.x;
    const y1 = rendered.y1 ?? rendered.y;
    const x2 = rendered.x2 ?? rendered.x + 80;
    const y2 = rendered.y2 ?? rendered.y;

    const lineStroke = isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault);
    const lineWidth = rendered.strokeWidth || 2;
    // Стиль пунктира: "5 5" / "10 5 2 5" → [5,5] / [10,5,2,5]; пусто → сплошная.
    const dashArr = (() => {
      const parts = (rendered.strokeDasharray || "").trim().split(/\s+/).map(Number);
      const nums = parts.filter((n) => Number.isFinite(n) && n >= 0);
      return nums.length ? nums : undefined;
    })();
    const arrowStart = !!rendered.arrowStart;
    const arrowEnd = !!rendered.arrowEnd;
    // Размер наконечника зависит от толщины линии.
    const pointerLength = Math.max(8, lineWidth * 2.5);
    const pointerWidth = Math.max(7, lineWidth * 2.2);

    return (
      <Group key={el.key} id={el.key}>
        <Arrow
          points={[x1, y1, x2, y2]}
          stroke={lineStroke}
          fill={lineStroke}
          strokeWidth={lineWidth}
          dash={dashArr}
          pointerAtBeginning={arrowStart}
          pointerAtEnding={arrowEnd}
          pointerLength={pointerLength}
          pointerWidth={pointerWidth}
          hitStrokeWidth={Math.max(12, lineWidth)}
          draggable
          onDragEnd={(e) => {
            const dx = e.target.x();
            const dy = e.target.y();
            e.target.position({ x: 0, y: 0 });
            updateElementVisual(el.key, {
              x1: snap(x1 + dx), y1: snap(y1 + dy),
              x2: snap(x2 + dx), y2: snap(y2 + dy),
              x: snap((x1 + x2) / 2 + dx), y: snap((y1 + y2) / 2 + dy),
            });
          }}
          onClick={(e) => {
            e.cancelBubble = true;
            onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
          }}
        />
        {isSelected && (
          <Anchor
            key={`${el.key}-anc-1`}
            x={x1}
            y={y1}
            themeColors={themeColors}
            onDragMove={(e) => {
              const sx = snap(e.target.x());
              const sy = snap(e.target.y());
              e.target.position({ x: sx, y: sy });
              // Пишем в стор только при пересечении шага сетки.
              if (sx !== x1 || sy !== y1) updateElementVisual(el.key, { x1: sx, y1: sy });
            }}
          />
        )}
        {isSelected && (
          <Anchor
            key={`${el.key}-anc-2`}
            x={x2}
            y={y2}
            themeColors={themeColors}
            onDragMove={(e) => {
              const sx = snap(e.target.x());
              const sy = snap(e.target.y());
              e.target.position({ x: sx, y: sy });
              // Пишем в стор только при пересечении шага сетки.
              if (sx !== x2 || sy !== y2) updateElementVisual(el.key, { x2: sx, y2: sy });
            }}
          />
        )}
      </Group>
    );
  }

  if (rendered.type === "text") {
    return (
      <TextShapeElement
        el={el}
        isSelected={isSelected}
        isEditing={ctx.editingTextKey === el.key}
        snap={snap}
        onElementClick={onElementClick}
        onStartTextEdit={ctx.onStartTextEdit}
        updateElementVisual={updateElementVisual}
      />
    );
  }

  if (rendered.type === "checkbox") {
    return (
      <CheckboxShapeElement
        el={el}
        isSelected={isSelected}
        snap={snap}
        onElementClick={onElementClick}
        updateElementVisual={updateElementVisual}
      />
    );
  }

  if (rendered.type === "progress_bar") {
    return (
      <ProgressBarShapeElement
        el={el}
        isSelected={isSelected}
        snap={snap}
        onElementClick={onElementClick}
        updateElementVisual={updateElementVisual}
      />
    );
  }

  if (rendered.type === "button") {
    return <ButtonShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "toggle") {
    return <ToggleShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "slider") {
    return <SliderShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "dropdown") {
    return <DropdownShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "input") {
    return <InputShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "gauge") {
    return <GaugeShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "table") {
    return (
      <TableShapeElement
        el={el} isSelected={isSelected} snap={snap}
        onElementClick={onElementClick} updateElementVisual={updateElementVisual}
        focusedCell={ctx.selectedTableCell?.elementKey === el.key ? ctx.selectedTableCell : null}
        onCellClick={ctx.onTableCellClick}
      />
    );
  }

  if (rendered.type === "trend") {
    return <TrendShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "chart") {
    return <ChartShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  if (rendered.type === "image") {
    return <ImageShapeElement el={el} isSelected={isSelected} snap={snap} onElementClick={onElementClick} updateElementVisual={updateElementVisual} />;
  }

  return (
    <Group
      key={el.key}
      id={el.key}
      x={rendered.x}
      y={rendered.y}
      rotation={rendered.rotate || 0}
      draggable
      onDragEnd={(e) => {
        updateElementVisual(el.key, {
          x: snap(e.target.x()),
          y: snap(e.target.y()),
        });
      }}
      onClick={(e) => {
        e.cancelBubble = true;
        onElementClick(el.key, e.evt.shiftKey || e.evt.ctrlKey);
      }}
    >
      <Rect
        width={rendered.w}
        height={rendered.h}
        fill={rendered.color || rendered.bg || "rgba(200,200,200,0.5)"}
        stroke={isSelected ? "#3b82f6" : (rendered.strokeColor || themeColors.strokeDefault)}
        strokeWidth={isSelected ? 2 : (rendered.strokeWidth || 1)}
        cornerRadius={rendered.rx || 0}
      />
      {rendered.label && (
        <Text
          text={rendered.label}
          width={rendered.w}
          height={rendered.h}
          align="center"
          verticalAlign="middle"
          fill={rendered.textColor || themeColors.labelDefault}
        />
      )}

      {/* Ресайз/поворот одиночного выделения делает SelectionTransformer (Canvas). */}
    </Group>
  );
}

/**
 * Мемоизировано: ctx собирается в Canvas через useMemo, поэтому пан/зум/маркиз/меню
 * не меняют его identity — вся сцена пропускает ре-рендер (иначе O(N) на каждый тик колеса).
 */
export const ShapeElement = React.memo(ShapeElementBase);
