"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { BaseElement } from "@/types/editorElement.type";

// SVG-компоненты, которые ожидают { element }
import { Lamp } from "@/components/SVGComponents/LampSVG";
import { Button } from "@/components/SVGComponents/ButtonSVG";
import { Indicator } from "@/components/SVGComponents/IndicatorSVG";
import Tank from "@/components/SVGComponents/TankSVG";          // ← теперь с element
import { Valve } from "@/components/SVGComponents/ValveSvg";
import { Text } from "@/components/SVGComponents/TextSvg";
import { NumericDisplay } from "@/components/SVGComponents/NumericDisplaySVG";
import Line from "@/components/SVGComponents/Line";
import Circle from "@/components/SVGComponents/Circle";
import Rectangle from "@/components/SVGComponents/Rectangle";
import Polygon from "@/components/SVGComponents/Polygon";
import Path from "@/components/SVGComponents/Path";


type Props = {
  element: BaseElement;
  isSelected: boolean;
  onMouseDownPort: (portId: string) => void;
  onMouseUpPort: (portId: string) => void;
};

export default function NodeElement({
  element,
  isSelected,
  onMouseDownPort,
  onMouseUpPort,
}: Props) {
  const containerClasses = cn(
    "w-full h-full relative flex items-center justify-center rounded overflow-hidden",
    isSelected && "ring-2 ring-blue-500 ring-offset-2 ring-offset-neutral-950",
  );

  const renderContent = () => {
    const common = {
      size: element.size ?? 60,
      color: element.color ?? undefined,
      label: element.label ?? element.type.charAt(0).toUpperCase() + element.type.slice(1),
    };

    switch (element.type) {
      case "line":
        return <Line element={element} />

      case "rectangle":
        return <Rectangle element={element} />

      case "circle":
        return <Circle element={element} />

      case "lamp":
        return <Lamp element={element} />

      case "polygon":
        return <Polygon element={element} />

      case "path":
        return <Path element={element} />

      case "button":
        return <Button element={element} />

      case "indicator":
        return <Indicator element={element} />

      case "tank":
        return <Tank element={element} />;  // ← теперь передаём весь element

      case "valve":
        return <Valve element={element} />;

      case "text":
        return <Text element={element} />;

      case "numeric":
        return <NumericDisplay element={element} />;

      default:
        return (
          <div className="text-neutral-500 text-sm italic p-4">
            Unsupported type: {element.type}
          </div>
        );
    }
  };

  return (
    <div className={containerClasses} style={{ background: "transparent" }}>
      {element.label && element.type !== "text" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-900/90 text-neutral-200 text-xs rounded border border-neutral-700 shadow-sm whitespace-nowrap z-10">
          {element.label}
        </div>
      )}

      {/* Основное содержимое */}
      <div className="w-full h-full flex items-center justify-center p-1 sm:p-2">
        {renderContent()}
      </div>
    </div>
  );
}