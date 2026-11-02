import React from "react";
import {SlidersHorizontal, Waypoints} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {isBooleanValueType, isNumericValueType, shortTagPath} from "@/core/scene";
import {getRuntimePropertyValue, getRuntimeTagQuality, getRuntimeTagValue, type InspectorPropertyDto} from "@/core/runtime";
import {inspectorTitle as title} from "../../lib/inspectorProps";
import {ValueWriteRow} from "../ValueWriteRow";

interface Props {
  property: InspectorPropertyDto;
  draft: string;
  /** Идёт запись именно этого свойства. */
  isWriting: boolean;
  /** Идёт какая-нибудь запись окна. */
  busy: boolean;
  onDraft: (value: string) => void;
  onWrite: () => void;
}

const valueOf = (p: InspectorPropertyDto) =>
  p.tag_id ? getRuntimeTagValue(p.tag_id) : getRuntimePropertyValue(p.id);
const isBadQuality = (p: InspectorPropertyDto) => {
  if (!p.tag_id) return false;
  const quality = getRuntimeTagQuality(p.tag_id);
  return quality !== undefined && quality !== "GOOD";
};

/** Строка инспектора: свойство (теговое или локальное), текущее значение и поле записи. */
export function InspectorPropertyRow({property: p, draft, isWriting, busy, onDraft, onWrite}: Props) {
  const value = valueOf(p);
  const isBool = isBooleanValueType(p.value_type ?? "");
  const bad = isBadQuality(p);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        {p.tag_id
          ? <Waypoints className="h-4 w-4 shrink-0 text-indigo-500" aria-label="тег" />
          : <SlidersHorizontal className="h-4 w-4 shrink-0 text-gray-400" aria-label="локальное свойство" />}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
            {title(p)}
          </span>
          {/* Как в «Опциях»: короткий путь тега, полный — в title; технический name
              рядом, если подпись его скрыла. */}
          <span
            className="block truncate text-xs text-gray-500 dark:text-gray-400"
            title={p.tag_id || undefined}
          >
            {p.label?.trim() ? `${p.name} · ` : ""}
            {p.tag_id ? shortTagPath(p.tag_id) : "локальное свойство"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span
            className={cn(
              "block text-sm font-medium",
              bad ? "text-gray-400 line-through" : "text-gray-900 dark:text-gray-100",
            )}
            title={bad ? "Значение недостоверно (качество тега не GOOD)" : undefined}
          >
            {value == null ? (p.tag_id ? "нет данных" : "не задано") : String(value)}
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            текущее значение
          </span>
        </span>
      </div>

      <ValueWriteRow
        isBool={isBool}
        numeric={isNumericValueType(p.value_type)}
        draft={draft}
        onDraft={onDraft}
        onWrite={onWrite}
        disabled={busy || (!isBool && !draft.trim())}
        label={isWriting ? "Запись..." : p.tag_id ? "Записать в ПЛК" : "Задать"}
        danger={Boolean(p.tag_id)}
        submitOnEnter
      />
    </div>
  );
}
