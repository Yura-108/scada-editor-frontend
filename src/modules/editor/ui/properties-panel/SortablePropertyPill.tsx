"use client";

import React from "react";
import {useSortable} from "@dnd-kit/sortable";
import {CSS} from "@dnd-kit/utilities";
import {GripVertical, Trash2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {PropertyCreateDto} from "@/core/scene";
import {shortTagPath} from "@/core/scene";
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
          ? "bg-warning/10 text-warning border-warning/30 hover:bg-warning/20"
          : "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn("cursor-grab active:cursor-grabbing -ml-1",
          wantsTag ? "text-warning/70 hover:text-warning" : "text-primary/70 hover:text-primary")}
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
        className={cn("hover:text-destructive transition-colors -mr-1",
          wantsTag ? "text-warning/70" : "text-primary/70")}
        title="Удалить свойство"
        aria-label={`Удалить «${label}»`}
      >
        <Trash2 size={12} />
      </button>
    </span>
  );
}
