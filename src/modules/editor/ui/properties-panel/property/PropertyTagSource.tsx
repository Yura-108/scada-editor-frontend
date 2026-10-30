import React from "react";
import {List} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {shortTagPath} from "@/core/scene";
import {TagTree} from "@/core/devices";
import {Tabs, type TabItem} from "@/shared/ui/Tabs";
import {VARIABLE_TAG_PREFIX, type AutomationVariable} from "@/types/automation.types";
import type {TagSource} from "./propertyOptions";

const SOURCES: TabItem<TagSource>[] = [
  {value: "channel", label: "Канал"},
  {value: "variable", label: "Переменная проекта"},
];

/**
 * Откуда свойство типа «Тег» берёт значение: канал из дерева устройств или переменная
 * проекта. У остальных типов tag_id пустой — так и пишем.
 */
export function PropertyTagSource({isTagType, propertyType, tagSource, onTagSource, channelTag, onChannelTag, variables, variableName, onChooseVariable}: {
  isTagType: boolean;
  propertyType: string;
  tagSource: TagSource;
  onTagSource: (source: TagSource) => void;
  channelTag: string | null;
  onChannelTag: (tag: string | null) => void;
  variables: AutomationVariable[] | null;
  variableName: string | null;
  onChooseVariable: (variable: AutomationVariable) => void;
}) {
  if (!isTagType) {
    return (
      <div className="flex items-start gap-3 rounded-lg border bg-muted px-4 py-3 text-sm text-muted-foreground">
        <List className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <span>
          Для типа <span className="font-medium text-foreground">{propertyType}</span> поле{" "}
          <span className="font-medium text-foreground">tag_id</span> будет пустым.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Tabs aria-label="Источник тега" value={tagSource} onValueChange={onTagSource} items={SOURCES} />

      {tagSource === "channel" ? (
        <>
          <TagTree className="h-[360px]" value={channelTag} onChange={onChannelTag} />
          {/* Полный путь оставляем в `title`: подпись короткая, но проверить,
              тот ли это узел дерева, по-прежнему можно наведением. */}
          <p className="text-xs text-muted-foreground" title={channelTag ?? undefined}>
            {channelTag
              ? `Выбран тег: ${shortTagPath(channelTag)}`
              : "Пока тег не выбран — кнопка сохранения будет недоступна."}
          </p>
        </>
      ) : (
        <div className="max-h-[360px] overflow-y-auto rounded-lg border p-2 space-y-1">
          {variables === null && <p className="text-sm text-muted-foreground px-2 py-1">Загрузка…</p>}
          {variables?.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-1">
              У проекта нет переменных — заведите их на странице «Автоматизация».
            </p>
          )}
          {variables?.map(v => (
            <button
              key={v.name}
              type="button"
              onClick={() => onChooseVariable(v)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm",
                variableName === v.name ? "bg-primary/15 text-primary" : "hover:bg-accent",
              )}
            >
              <span className="font-mono">{VARIABLE_TAG_PREFIX}{v.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{v.value_type}{v.description ? ` · ${v.description}` : ""}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
