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
    // Базовые дефолты, если в элементе ничего нет
    const common = {
      size: element.size ?? 60,
      color: element.color ?? undefined,
      label: element.label ?? element.type.charAt(0).toUpperCase() + element.type.slice(1),
    };

    switch (element.type) {
      case "lamp":
        return <Lamp element={element} />;

      case "button":
        return <Button element={element} />;

      case "indicator":
        return <Indicator element={element} />;

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
    <div className={containerClasses} style={{ background: element.bg || "transparent" }}>
      {/* Лейбл сверху (если не текстовый элемент) */}
      {element.label && element.type !== "text" && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2.5 py-1 bg-neutral-900/90 text-neutral-200 text-xs rounded border border-neutral-700 shadow-sm whitespace-nowrap z-10">
          {element.label}
        </div>
      )}

      {/* Основное содержимое */}
      <div className="w-full h-full flex items-center justify-center p-1 sm:p-2">
        {renderContent()}
      </div>

      {/* Порты */}
      {element.ports?.map((port) => {
        const portStyle: React.CSSProperties = {};
        switch (port.position) {
          case "top":
            portStyle.top = -8;
            portStyle.left = "50%";
            portStyle.transform = "translateX(-50%)";
            break;
          case "bottom":
            portStyle.bottom = -8;
            portStyle.left = "50%";
            portStyle.transform = "translateX(-50%)";
            break;
          case "left":
            portStyle.left = -8;
            portStyle.top = "50%";
            portStyle.transform = "translateY(-50%)";
            break;
          case "right":
            portStyle.right = -8;
            portStyle.top = "50%";
            portStyle.transform = "translateY(-50%)";
            break;
        }

        return (
          <div
            key={port.id}
            className={cn(
              "absolute w-4 h-4 bg-white border-2 border-gray-500 rounded-full cursor-crosshair z-20",
              "hover:bg-blue-400 hover:border-blue-600 hover:scale-125 transition-all duration-150",
              port.connected && "bg-green-500 border-green-700 shadow-green-500/50 shadow-md"
            )}
            style={portStyle}
            onMouseDown={(e) => {
              e.stopPropagation();
              onMouseDownPort(port.id);
            }}
            onMouseUp={(e) => {
              e.stopPropagation();
              onMouseUpPort(port.id);
            }}
            title={port.label || port.position}
          />
        );
      })}
    </div>
  );
}