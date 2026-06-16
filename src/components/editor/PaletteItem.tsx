"use client";

import {useDraggable} from "@dnd-kit/core";
import {PaletteItemType} from "@/types/palette.types";
import {usePaletteStore} from "@/store/usePaletteStore";
import {Trash2} from "lucide-react";

const STATIC_ID_THRESHOLD = 10 ** 5;

interface PaletteItemProps {
  item: PaletteItemType;
}

export default function PaletteItem({item}: PaletteItemProps) {
  const {deletePaletteItem} = usePaletteStore();
  const isStatic = item.id >= STATIC_ID_THRESHOLD;

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
    <div className="group relative flex items-center gap-1">
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-[#1b1b1b] dark:hover:bg-[#262626]
                 text-gray-900 dark:text-gray-100 px-3 py-2 rounded cursor-grab
                 flex items-center transition-colors"
      >
        <span className="text-sm truncate">{item.name}</span>
      </div>

      {!isStatic && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => deletePaletteItem(item.id)}
          className="p-1.5 rounded text-neutral-400 hover:text-red-500
                   hover:bg-red-500/10 shrink-0 opacity-0 group-hover:opacity-100
                   transition-all duration-200"
          title="Удалить шаблон"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}