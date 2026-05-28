"use client";

import {useDraggable} from "@dnd-kit/core";
import {PaletteItemType} from "@/types/palette.types";

interface PaletteItemProps {
  item: PaletteItemType;
}

export default function PaletteItem({item}: PaletteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
  } = useDraggable({id: item.id, data: {
      type: item.type,
      template: item.template,
      isTemplate: true
    }});

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="bg-gray-100 hover:bg-gray-200 dark:bg-[#1b1b1b] dark:hover:bg-[#262626] text-gray-900 dark:text-gray-100 px-3 py-2 rounded cursor-grab flex items-center gap-3 transition-colors"
    >
      <span className="text-sm">{item.name}</span>
    </div>
  );
}