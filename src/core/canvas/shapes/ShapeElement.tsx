"use client";

import React from "react";
import { DiagramElement, LeafElement } from "@/core/scene";
import {getRenderedElementWith} from "@/core/scene";
import { EditorRenderContext } from "../types";
import { PolygonShapeElement } from "./PolygonShapeElement";
import { CircleShapeElement } from "./CircleShapeElement";
import { LineShapeElement } from "./LineShapeElement";
import { RectShapeElement } from "./RectShapeElement";
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
import { ArcShapeElement } from "./ArcShapeElement";
import { CurveShapeElement } from "./CurveShapeElement";

interface ShapeElementProps {
  el: DiagramElement;
  ctx: EditorRenderContext;
  /** Уже с учётом Transformer: у его цели своя рамка не рисуется. */
  isSelected: boolean;
  /** Текст редактируется инлайн — Konva-текст прячется под textarea. */
  isEditing: boolean;
  /** Сфокусированная ячейка таблицы, если она принадлежит этому элементу. */
  focusedCell: { elementKey: string; row: number; col: number } | null;
  /** Активное состояние элемента: его overrides и рисуются поверх базовых полей. */
  stateId: string | undefined;
  /** Рантайм-оверрайды монитора (значения тегов) — поверх состояния. */
  runtime: Record<string, unknown> | undefined;
}

/**
 * Рендерит листовой элемент холста: считает его вид и выбирает компонент по типу
 * (тип без своего компонента рисуется прямоугольником).
 *
 * Всё изменчивое приходит пропами от CanvasNode, который подписан на свой срез
 * стора: раньше эти же данные читались из общего контекста, и любое изменение
 * схемы перерисовывало все фигуры сразу.
 */
function ShapeElementBase({ el, ctx, isSelected, isEditing, focusedCell, stateId, runtime }: ShapeElementProps) {
  const { snap, updateElementVisual, onElementClick, closeMenu, themeColors } = ctx;
  // Именно `…With`, а не `getRenderedElement`: тот читает активное состояние из стора
  // нереактивно, и фигура под `React.memo` не узнавала бы о его смене.
  const rendered = getRenderedElementWith(el, stateId, runtime) as LeafElement;

  // Общий набор пропов всех листовых компонентов. Раньше каждая ветка перечисляла
  // их вручную, и добавление пропы означало пятнадцать одинаковых правок — ровно
  // так `stateId`/`runtime` и потерялись бы у половины типов.
  const leafProps = { el, isSelected, snap, onElementClick, updateElementVisual, stateId, runtime };

  if (rendered.type === "polygon") {
    return <PolygonShapeElement {...leafProps} rendered={rendered} themeColors={themeColors} closeMenu={closeMenu} />;
  }

  if (rendered.type === "circle") {
    return (
      <CircleShapeElement
        {...leafProps}
        rendered={rendered}
        themeColors={themeColors}
        isEditing={isEditing}
        onStartTextEdit={ctx.onStartTextEdit}
      />
    );
  }

  if (rendered.type === "line") {
    return <LineShapeElement {...leafProps} rendered={rendered} themeColors={themeColors} />;
  }

  if (rendered.type === "arc") {
    return <ArcShapeElement {...leafProps} />;
  }

  if (rendered.type === "curve") {
    return <CurveShapeElement {...leafProps} />;
  }

  if (rendered.type === "text") {
    return (
      <TextShapeElement
        {...leafProps}
        isEditing={isEditing}
        onStartTextEdit={ctx.onStartTextEdit}
      />
    );
  }

  if (rendered.type === "checkbox") {
    return <CheckboxShapeElement {...leafProps} />;
  }

  if (rendered.type === "progress_bar") {
    return <ProgressBarShapeElement {...leafProps} />;
  }

  if (rendered.type === "button") {
    return <ButtonShapeElement {...leafProps} />;
  }

  if (rendered.type === "toggle") {
    return <ToggleShapeElement {...leafProps} />;
  }

  if (rendered.type === "slider") {
    return <SliderShapeElement {...leafProps} />;
  }

  if (rendered.type === "dropdown") {
    return <DropdownShapeElement {...leafProps} />;
  }

  if (rendered.type === "input") {
    return <InputShapeElement {...leafProps} />;
  }

  if (rendered.type === "gauge") {
    return <GaugeShapeElement {...leafProps} />;
  }

  if (rendered.type === "table") {
    return (
      <TableShapeElement
        {...leafProps}
        focusedCell={focusedCell}
        onCellClick={ctx.onTableCellClick}
        themeColors={themeColors}
      />
    );
  }

  if (rendered.type === "trend") {
    return <TrendShapeElement {...leafProps} />;
  }

  if (rendered.type === "chart") {
    return <ChartShapeElement {...leafProps} />;
  }

  if (rendered.type === "image") {
    return <ImageShapeElement {...leafProps} />;
  }

  return <RectShapeElement {...leafProps} rendered={rendered} themeColors={themeColors} />;
}

/** Мемоизировано: пропы — сам элемент, стабильный ctx и несколько примитивов. */
export const ShapeElement = React.memo(ShapeElementBase);
