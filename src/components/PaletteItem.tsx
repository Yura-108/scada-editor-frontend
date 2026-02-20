"use client";

import {useDraggable} from "@dnd-kit/core";
import {PaletteItemType} from "../types/palette.types";

interface PaletteItemProps {
  item: PaletteItemType;
}

export default function PaletteItem({item}: PaletteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
  } = useDraggable({id: item.type});

  const Icon = item.iconComponent;

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="bg-[#1b1b1b] hover:bg-[#262626] px-3 py-2 rounded cursor-grab flex items-center gap-3"
    >
      {Icon && <Icon size={28} />}
      <span className="text-sm">{item.label}</span>
    </div>
  );
}