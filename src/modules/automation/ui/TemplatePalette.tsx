"use client";

import React, {useMemo, useState} from "react";
import {ChevronDown, Pencil, Trash2, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Button} from "@/shared/ui/Button";
import {Banner} from "@/shared/ui/Banner";
import {EmptyState} from "@/shared/ui/EmptyState";
import {Spinner} from "@/shared/ui/Spinner";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {useDeleteTemplate, useTemplates} from "../api/templates";
import {groupTemplates} from "../lib/automationTemplates";
import {openTemplateModal} from "./OpenTemplateModal";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";
import {SearchInput} from "@/shared/ui/field/SearchInput";

/** Общий пустой список: `?? []` в рендере давал бы новый массив и сбивал useMemo. */
const NO_TEMPLATES: AutomationTaskTemplate[] = [];

interface Props {
  /** Вставка кладёт в набор черновик задачи; сохраняет его обычное сохранение набора. */
  /** Нет — нет права правки в проекте: шаблоны видны, но вставить их некуда. */
  onInsert?: (template: AutomationTaskTemplate) => void;
}

/**
 * Палитра заготовок задач — общая для всех проектов, фильтра по проекту нет.
 * Порядок внутри группы задаёт сервер (по имени), группировка по категории — здесь.
 */
export function TemplatePalette({onInsert}: Props) {
  const templates = useTemplates();
  const items = templates.data ?? NO_TEMPLATES;
  // Пока есть список, перечитка (после сохранения) идёт фоном и список не прячется.
  // Без списка «Повторить» после ошибки снова показывает «Загрузка…», а не старую ошибку.
  const status =
    templates.status === "success" ? "ready" : templates.isFetching ? "loading" : "error";
  const error = templates.error
    ? templates.error.message || "Не удалось загрузить шаблоны задач"
    : null;
  const reload = templates.refetch;
  const {mutate: deleteTemplate} = useDeleteTemplate();

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = needle
      ? items.filter(t => t.name.toLowerCase().includes(needle))
      : items;
    return groupTemplates(filtered);
  }, [items, search]);

  // При поиске держим группы раскрытыми: иначе найденное прячется в свёрнутой категории.
  const isSearching = search.trim().length > 0;
  const isExpanded = (category: string) => isSearching || !collapsed[category];

  const handleDelete = async (template: AutomationTaskTemplate) => {
    const ok = await confirmModal({
      title: `Удалить шаблон «${template.name}»?`,
      description: "Восстановить будет нечем: истории у шаблонов нет. "
        + "На уже созданные из него задачи удаление не влияет.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (ok && template.id != null) void deleteTemplate(template.id);
  };

  return (
    <aside className="w-72 shrink-0 border-l border-neutral-200 dark:border-neutral-800 flex flex-col min-h-0">
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
          Шаблоны задач
        </div>
        <div className="relative">
          <SearchInput
            size="sm"
            placeholder="Поиск шаблонов…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            inputClassName="pr-7"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {status === "loading" && <Spinner label="Загрузка…" className="px-1" />}

        {status === "error" && (
          <Banner tone="destructive" title="Палитра шаблонов недоступна." className="px-3 py-2">
            {error && <p className="text-xs break-words">{error}</p>}
            <Button size="sm" className="mt-2 w-full" onClick={() => void reload()}>Повторить</Button>
          </Banner>
        )}

        {status === "ready" && items.length === 0 && (
          <EmptyState size="sm" title="Шаблонов ещё нет: сохраните готовую задачу как шаблон кнопкой «В шаблоны»." />
        )}

        {status === "ready" && items.length > 0 && groups.length === 0 && (
          <EmptyState size="sm" title="Ничего не найдено" />
        )}

        {groups.map(group => (
          <div key={group.category} className="space-y-1">
            <button
              onClick={() => !isSearching && setCollapsed(c => ({...c, [group.category]: !c[group.category]}))}
              disabled={isSearching}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800/50 disabled:hover:bg-transparent"
            >
              <ChevronDown
                size={14}
                className={cn("text-neutral-500 shrink-0 transition-transform", !isExpanded(group.category) && "-rotate-90")}
              />
              <span className="flex-1 text-left text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 truncate">
                {group.category}
              </span>
              <span className="text-xs text-neutral-500 shrink-0">{group.items.length}</span>
            </button>

            {isExpanded(group.category) && (
              <div className="space-y-1 pl-1">
                {group.items.map(template => (
                  <div
                    key={template.id}
                    className="group/tpl flex items-center gap-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <button
                      onClick={() => onInsert?.(template)}
                      disabled={!onInsert}
                      className="flex-1 min-w-0 text-left px-2 py-1.5 disabled:cursor-not-allowed disabled:opacity-60"
                      title={!onInsert ? "Нет права правки в проекте — вставить задачу нельзя" : template.description || `Вставить «${template.name}» в набор`}
                    >
                      <div className="truncate text-sm">{template.name}</div>
                      {template.description && (
                        <div className="truncate text-xs text-neutral-500">{template.description}</div>
                      )}
                    </button>
                    <button
                      onClick={() => openTemplateModal({mode: "edit", initial: template})}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-indigo-500 opacity-0 group-hover/tpl:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                      title="Править шаблон"
                      aria-label={`Править «${template.name}»`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => void handleDelete(template)}
                      className="p-1.5 rounded-md text-neutral-400 hover:text-red-500 opacity-0 group-hover/tpl:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0"
                      title="Удалить шаблон"
                      aria-label={`Удалить «${template.name}»`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
