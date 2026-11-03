import React from "react";
import {Boxes, Tag, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import type {TagScope} from "@/core/runtime";
import type {PropertyRef} from "@/core/scene";
import {chipClasses} from "./scriptStyles";

/** Чипы тегов элемента: клик вставляет переменную в код. Тегов нет — ничего не рисуется. */
export function TagChips({scope, onInsert}: {scope: TagScope; onInsert: (text: string) => void}) {
  if (!scope.names.some(n => n in scope.tagIdByName)) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Теги:</span>
      {scope.names
        .filter(n => n in scope.tagIdByName)
        .map(tagName => (
          <span
            key={tagName}
            className={chipClasses}
            title={scope.tagIdByName[tagName]}
            onClick={() => onInsert(tagName)}
          >
            <Tag size={12} />
            {tagName}
          </span>
        ))}
    </div>
  );
}

/**
 * Свойства других компонентов сцены, на которые ссылается скрипт, и кнопка выбора нового.
 * Что вставит клик по чипу, решает редактор (`onInsert`): привязка — переменную,
 * событие — `setProperty(…)`.
 */
export function PropertyRefChips({refs, titleOf, onInsert, onRemove, onPick}: {
  refs: PropertyRef[];
  titleOf: (ref: PropertyRef) => string;
  onInsert: (ref: PropertyRef) => void;
  onRemove: (propertyId: number) => void;
  onPick: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">Свойства:</span>
      {refs.map(ref => (
        <span
          key={ref.propertyId}
          className={cn(chipClasses, "bg-success/10 text-success border-success/30 hover:bg-success/20")}
          title={titleOf(ref)}
          onClick={() => onInsert(ref)}
        >
          <Boxes size={12} />
          {ref.varName}
          <X
            size={11}
            className="ml-0.5 hover:text-destructive"
            onClick={e => {
              e.stopPropagation();
              onRemove(ref.propertyId);
            }}
          />
        </span>
      ))}
      <button
        type="button"
        onClick={onPick}
        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full border border-dashed border-success/50 text-success hover:bg-success/10 transition-colors"
      >
        <Boxes size={12} />
        Выбрать свойства объекта
      </button>
    </div>
  );
}
