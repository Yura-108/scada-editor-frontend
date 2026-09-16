"use client";

import React, {useEffect, useMemo, useState} from "react";
import {ChevronDown, Pencil, Search, Trash2, X} from "lucide-react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/Button";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {useAutomationTemplateStore} from "@/store/useAutomationTemplateStore";
import {groupTemplates} from "@/lib/automation/automationTemplates";
import {openTemplateModal} from "@/components/automation/OpenTemplateModal";
import type {AutomationTaskTemplate} from "@/types/automationTemplate.types";

interface Props {
  /** Вставка кладёт в набор черновик задачи; сохраняет его обычное сохранение набора. */
  onInsert: (template: AutomationTaskTemplate) => void;
}

/**
 * Палитра заготовок задач — общая для всех проектов, фильтра по проекту нет.
 * Порядок внутри группы задаёт сервер (по имени), группировка по категории — здесь.
 */
export function TemplatePalette({onInsert}: Props) {
  const items = useAutomationTemplateStore(s => s.items);
  const status = useAutomationTemplateStore(s => s.status);
  const error = useAutomationTemplateStore(s => s.error);
  const loadTemplates = useAutomationTemplateStore(s => s.loadTemplates);
  const reload = useAutomationTemplateStore(s => s.reload);
  const deleteTemplate = useAutomationTemplateStore(s => s.deleteTemplate);

  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  useEffect(() => { void loadTemplates(); }, [loadTemplates]);

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
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" size={14} />
          <input
            type="text"
            placeholder="Поиск шаблонов…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 pl-8 pr-7 py-1.5 text-sm"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {status === "loading" && <p className="text-sm text-neutral-500 px-1">Загрузка…</p>}

        {status === "error" && (
          <div className="px-1 space-y-2">
            <p className="text-sm text-neutral-500">Палитра шаблонов недоступна.</p>
            {error && <p className="text-xs text-neutral-500 break-words">{error}</p>}
            <Button className="w-full" onClick={() => void reload()}>Повторить</Button>
          </div>
        )}

        {status === "ready" && items.length === 0 && (
          <p className="text-sm text-neutral-500 px-1">
            Шаблонов ещё нет: сохраните готовую задачу как шаблон кнопкой «В шаблоны».
          </p>
        )}

        {status === "ready" && items.length > 0 && groups.length === 0 && (
          <p className="text-sm text-neutral-500 px-1">Ничего не найдено</p>
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
                      onClick={() => onInsert(template)}
                      className="flex-1 min-w-0 text-left px-2 py-1.5"
                      title={template.description || `Вставить «${template.name}» в набор`}
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
