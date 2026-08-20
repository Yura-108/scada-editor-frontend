"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {LeafElement} from "@/types/editorElement.type";
import { Button } from "@/components/ui/SVGComponents/ButtonSVG";
import { ProgressBar } from "@/components/ui/SVGComponents/ProgressBarSVG";
import { Checkbox } from "@/components/ui/SVGComponents/CheckboxSVG";
import { Text } from "@/components/ui/SVGComponents/TextSvg";
import Circle from "@/components/ui/SVGComponents/Circle";
import Rectangle from "@/components/ui/SVGComponents/Rectangle";
import Polygon from "@/components/ui/SVGComponents/Polygon";
import Path from "@/components/ui/SVGComponents/Path";
import {getRenderedElement} from "@/lib/getRenderedElement";


type Props = {
  element: LeafElement;
  isSelected: boolean;
};

export default function NodeElement({
  element,
  isSelected,
}: Props) {
  const containerClasses = cn(
    "relative flex items-center justify-center rounded overflow-hidden",
    isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-950",
  );

  const renderedElement = getRenderedElement(element);

  const renderContent = () => {
    switch (renderedElement.type) {
      case "rectangle":
        return <Rectangle element={renderedElement} />

      case "circle":
        return <Circle element={renderedElement} />

      case "polygon":
        return <Polygon element={renderedElement} />

      case "path":
        return <Path element={renderedElement} />

      case "button":
        return <Button element={renderedElement} />

      case "progress_bar":
        return <ProgressBar element={renderedElement} />

      case "checkbox":
        return <Checkbox element={renderedElement} />

      case "text":
        return <Text element={renderedElement} />

      default:
        return (
          <div className="text-neutral-500 text-sm italic p-4">
            Неизвестный тип элемента: {element.type}
          </div>
        );
    }
  };

  return (
    <div
      className={containerClasses}
      style={{ background: "transparent" }}
    >
      {element.label && element.type !== "text" && element.type !== "checkbox" && element.type !== "progress_bar" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-white dark:bg-neutral-900/90 text-neutral-800 dark:text-neutral-200 text-xs rounded border border-neutral-300 dark:border-neutral-700 shadow-sm whitespace-nowrap z-10">
          {element.label}
        </div>
      )}

      <div className="w-full h-full flex items-center justify-center p-1 box-border">
        {renderContent()}
      </div>
    </div>
  );
}
