"use client";

import React from "react";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {GripVertical, Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {PropertyCreateDto} from "@/types/tags.types";
import {shortTagPath} from "@/lib/editor/tagPath";
import {needsTag, propertyKey} from "./lib/propertyOrder";

/**
 * «Таблетка» свойства в общем списке: ручка перетаскивания (attributes/listeners
 * dnd-kit) висит ТОЛЬКО на иконке — остальная часть таблетки сохраняет исходный
 * onClick открытия модалки редактирования, drag и клик не конфликтуют.
 */
export function SortablePropertyPill({property, onClick, onDelete}: {property: PropertyCreateDto; onClick: () => void; onDelete: () => void}) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id: propertyKey(property)});
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const wantsTag = needsTag(property);
  const label = `${property.name || property.property_type || "Свойство"}${
    property.tag_id ? ` • ${shortTagPath(property.tag_id)}` : wantsTag ? " • нужен тег" : ""
  }`;

  // Ручка и подпись — две отдельные кнопки внутри оболочки-таблетки.
  // Кнопку внутрь кнопки вкладывать нельзя, а раньше и то и другое было
  // кликабельными <span>: таблетка не открывалась с клавиатуры, а ручка dnd-kit
  // не получала фокус, из-за чего клавиатурное перетаскивание не работало.
  return (
    <span
      ref={setNodeRef}
      style={style}
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-1.5",
        "text-xs font-medium rounded-full",
        "border transition-colors",
        // Ненастроенное теговое свойство видно списком, без раскрытия каждой строки.
        wantsTag
          ? "bg-amber-950/60 text-amber-300 border-amber-700/50 hover:bg-amber-900/70"
          : "bg-indigo-950/60 text-indigo-300 border-indigo-800/40 hover:bg-indigo-900/70"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn("cursor-grab active:cursor-grabbing -ml-1",
          wantsTag ? "text-amber-400/70 hover:text-amber-200" : "text-indigo-400/70 hover:text-indigo-200")}
        title="Перетащить для изменения порядка"
        aria-label={`Перетащить «${label}» для изменения порядка`}
      >
        <GripVertical size={12} />
      </button>
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer text-left"
        title={property.tag_id ?? undefined}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={onDelete}
        className={cn("hover:text-red-400 transition-colors -mr-1",
          wantsTag ? "text-amber-400/70" : "text-indigo-400/70")}
        title="Удалить свойство"
        aria-label={`Удалить «${label}»`}
      >
        <Trash2 size={12} />
      </button>
    </span>
  );
}
