"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {LeafElement} from "@/types/editorElement.type";

// SVG-компоненты, которые ожидают { element }
import { Lamp } from "@/components/SVGComponents/LampSVG";
import { Button } from "@/components/SVGComponents/ButtonSVG";
import { Indicator } from "@/components/SVGComponents/IndicatorSVG";
import Tank from "@/components/SVGComponents/TankSVG";          // ← теперь с element
import { Valve } from "@/components/SVGComponents/ValveSvg";
import { Text } from "@/components/SVGComponents/TextSvg";
import { NumericDisplay } from "@/components/SVGComponents/NumericDisplaySVG";
import Circle from "@/components/SVGComponents/Circle";
import Rectangle from "@/components/SVGComponents/Rectangle";
import Polygon from "@/components/SVGComponents/Polygon";
import Path from "@/components/SVGComponents/Path";
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

      case "lamp":
        return <Lamp element={renderedElement} />

      case "polygon":
        return <Polygon element={renderedElement} />

      case "path":
        return <Path element={renderedElement} />

      case "button":
        return <Button element={renderedElement} />

      case "indicator":
        return <Indicator element={renderedElement} />

      case "tank":
        return <Tank element={renderedElement} />

      case "valve":
        return <Valve element={renderedElement} />;

      case "text":
        return <Text element={renderedElement} />;

      case "numeric":
        return <NumericDisplay element={renderedElement} />;

      default:
        return (
          <div className="text-neutral-500 text-sm italic p-4">
            Unsupported type: {element.type}
          </div>
        );
    }
  };

  return (
    <div
      className={containerClasses}
      style={{ background: "transparent" }}
      onDoubleClick={e => console.log(e)}
    >
      {element.label && element.type !== "text" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-900/90 text-neutral-200 text-xs rounded border border-neutral-700 shadow-sm whitespace-nowrap z-10">
          {element.label}
        </div>
      )}

      {/* Основное содержимое */}
      <div className="w-full h-full flex items-center justify-center p-1 box-border">
        {renderContent()}
      </div>
    </div>
  );
}