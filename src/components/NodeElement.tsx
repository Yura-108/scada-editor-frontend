"use client";
import React from "react";
import {BaseElement} from "@/types/editorElement.type";
import {LampSVG} from "@/components/SVGComponents/LampSVG";
import {ButtonSVG} from "@/components/SVGComponents/ButtonSVG";
import {IndicatorSVG} from "@/components/SVGComponents/IndicatorSVG";
import TankSVG from "@/components/SVGComponents/TankSVG";

type Props = {
  element: BaseElement;
  isSelected: boolean;
  onMouseDownPort: (portId: string) => void;
  onMouseUpPort: (portId: string) => void;
};

export default function NodeElement({ element, isSelected, onMouseDownPort, onMouseUpPort }: Props) {
  return (
    <div
      className={`w-full h-full relative flex items-center justify-center rounded ${
        isSelected ? "border-2 border-blue-500 bg-blue-50" : "border border-gray-400 bg-white"
      }`}
      style={{ background: element.bg || "#fff" }}
    >
      {/* Лейбл */}


      {/* Простейшие порты */}
      {element.ports?.map((port) => {
        const style: React.CSSProperties = {};
        switch (port.position) {
          case "top": style.top = -6; style.left = "50%"; style.transform = "translateX(-50%)"; break;
          case "bottom": style.bottom = -6; style.left = "50%"; style.transform = "translateX(-50%)"; break;
          case "left": style.left = -6; style.top = "50%"; style.transform = "translateY(-50%)"; break;
          case "right": style.right = -6; style.top = "50%"; style.transform = "translateY(-50%)"; break;
        }

        return (
          <div
            key={port.id}
            className="port z-10 absolute w-3 h-3 bg-white border border-gray-600 rounded-full cursor-crosshair"
            style={style}
            onMouseDown={(e) => { e.stopPropagation(); onMouseDownPort(port.id); }}
            onMouseUp={(e) => { e.stopPropagation(); onMouseUpPort(port.id); }}
          />
        );
      })}

      {/* Тип элемента, например кнопка или лампа */}
      {element.type === "lamp" && <LampSVG />}
      {element.type === "button" && <ButtonSVG />}
      {element.type === "indicator" && <IndicatorSVG />}
      {element.type === "tank" && <TankSVG />}
    </div>
  );
}