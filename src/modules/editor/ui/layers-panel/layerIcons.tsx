import React from "react";
import {Boxes, Folder, Square, Circle as CircleIcon, Minus, Type, Radius, PenTool, CheckSquare, SlidersHorizontal, MousePointerClick, ToggleLeft, ChevronsUpDown, TextCursorInput, Spline, BarChart3} from "lucide-react";
import type {DiagramElement} from "@/core/scene";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  rectangle: <Square size={13} />,
  circle: <CircleIcon size={13} />,
  arc: <Radius size={13} />,
  curve: <PenTool size={13} />,
  line: <Minus size={13} />,
  polygon: <Spline size={13} />,
  text: <Type size={13} />,
  checkbox: <CheckSquare size={13} />,
  progress_bar: <BarChart3 size={13} />,
  button: <MousePointerClick size={13} />,
  toggle: <ToggleLeft size={13} />,
  slider: <SlidersHorizontal size={13} />,
  dropdown: <ChevronsUpDown size={13} />,
  input: <TextCursorInput size={13} />,
};

/** Иконка строки слоёв: компонент, группа или тип элемента (неизвестный — квадрат). */
export const layerIcon = (el: DiagramElement): React.ReactNode =>
  el.type === "group"
    ? (el.isComponent ? <Boxes size={13} /> : <Folder size={13} />)
    : (TYPE_ICONS[el.type] ?? <Square size={13} />);
