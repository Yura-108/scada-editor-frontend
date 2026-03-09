import { Line } from "./Line";
import {useEditorStore} from "@/store/useEditorStore";
import {LeafElement} from "@/types/editorElement.type";
import React from "react";

interface Props {
  onSelect: (id: string, e: React.MouseEvent) => void;
}

export function LinesLayer({onSelect}: Props) {
  const { elements } = useEditorStore();

  const lines = elements.filter(el => el.type === "line");

  return (
    <svg className="absolute inset-0 w-full h-full">
      {lines.map((line) => (
        <Line key={line.key} element={line as LeafElement} onSelect={onSelect} />
      ))}
    </svg>
  );
}