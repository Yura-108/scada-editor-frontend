import React from "react";
import {Waypoints} from "lucide-react";
import {isBooleanValueType, shortTagPath, type PropertyCreateDto} from "@/core/scene";
import {isNumericType, propertyTitle} from "../../lib/optionRows";
import {ValueWriteRow} from "../ValueWriteRow";

interface Props {
  property: PropertyCreateDto;
  /** Значение, нарисованное на холсте сейчас. */
  shownValue: string;
  draft: string;
  /** Идёт запись именно этого тега. */
  isWriting: boolean;
  /** Идёт какая-нибудь запись окна. */
  isBusy: boolean;
  onDraft: (value: string) => void;
  onWrite: () => void;
}

/** Строка «Опций»: свойство, путь тега, текущее значение и поле записи в ПЛК. */
export function TagPropertyRow({property: p, shownValue, draft, isWriting, isBusy, onDraft, onWrite}: Props) {
  const tagId = p.tag_id ?? "";
  const isBool = isBooleanValueType(p.value_type);

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-3">
        <Waypoints className="h-4 w-4 shrink-0 text-tag" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">
            {propertyTitle(p)}
          </span>
          {/* Полный путь — в title: подпись короткая, но узел проверить можно.
              Технический name — рядом, если подпись его скрыла: он нужен при
              отладке скриптов. */}
          <span
            className="block truncate text-xs text-muted-foreground"
            title={tagId || undefined}
          >
            {p.label?.trim() ? `${p.name} · ` : ""}
            {tagId ? shortTagPath(tagId) : "тег не назначен"}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block text-sm font-medium text-foreground">
            {shownValue}
          </span>
          <span className="block text-xs text-muted-foreground">
            текущее значение
          </span>
        </span>
      </div>

      <ValueWriteRow
        isBool={isBool}
        numeric={isNumericType(p.value_type)}
        draft={draft}
        onDraft={onDraft}
        onWrite={onWrite}
        disabled={!tagId || isBusy || (!isBool && !draft.trim())}
        label={isWriting ? "Запись..." : "Записать в ПЛК"}
        danger
      />
    </div>
  );
}
