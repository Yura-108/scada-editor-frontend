"use client";

import { useState } from "react";
import PaletteItem from "./PaletteItem";
import {Search, X, ChevronDown, Trash2} from "lucide-react";
import {filterPalette, groupPalette, sortCategories} from "@/lib/palette-utils";
import {PaletteItemType} from "@/types/palette.types";
import {usePaletteStore} from "@/store/usePaletteStore";
import {confirmModal} from "@/components/ui/ConfirmModal";

const STATIC_ID_THRESHOLD = 10 ** 5;

export default function Palette() {
  const {paletteItems, deletePaletteCategory} = usePaletteStore();
  const [search, setSearch] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const filtered = filterPalette(paletteItems, search);
  const grouped = groupPalette(filtered);
  const sortedCategories = sortCategories(grouped);

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // При поиске все категории раскрываются автоматически
  const isSearchActive = search.trim().length > 0;
  const getCategoryExpandedState = (category: string) => {
    return isSearchActive || expandedCategories[category] !== false;
  };

  return (
    <div className="h-full flex flex-col bg-neutral-50 dark:bg-neutral-950/70 border-r border-neutral-200 dark:border-neutral-800">
      {/* Поиск */}
      <div className="p-4 pb-3 border-b border-neutral-200 dark:border-neutral-800 shrink-0">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            size={16}
          />
          <input
            type="text"
            placeholder="Поиск элементов..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`
              w-full bg-white dark:bg-neutral-900/70 border border-neutral-300 dark:border-neutral-700 rounded-lg
              pl-10 pr-4 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-500
              focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/50
              transition-all
            `}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Очистить поиск"
              title="Очистить поиск"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-700 dark:text-neutral-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3 custom-scrollbar">
        {sortedCategories.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm py-10">
            Ничего не найдено
          </div>
        ) : (
          sortedCategories.map((category) => {
            const isExpanded = getCategoryExpandedState(category);
            const items: PaletteItemType[] = grouped[category];
            const isDeletableCategory = items.every(item => item.id < STATIC_ID_THRESHOLD);

            return (
              <div key={category} className="space-y-2">
                <div className="group/cat flex items-center gap-1">
                  {/* Основная кликабельная область */}
                  <button
                    onClick={() => !isSearchActive && toggleCategory(category)}
                    disabled={isSearchActive}
                    className="flex-1 flex items-center gap-2 px-3 py-2 rounded-md transition-all hover:bg-neutral-100 dark:hover:bg-neutral-800/50 disabled:hover:bg-transparent"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-neutral-500 transition-transform shrink-0 ${
                        isExpanded ? "" : "-rotate-90"
                      }`}
                    />
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 text-left flex-1 truncate">
                      {category}
                    </h3>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium shrink-0">
                {items.length}
              </span>
                  </button>

                  {/* Кнопка удаления группы — справа */}
                  {isDeletableCategory && (
                    <button
                      onClick={async () => {
                        // Удаление категории необратимо (серверная операция вне undo),
                        // а порог у неё был самый низкий — один клик по иконке.
                        const confirmed = await confirmModal({
                          title: `Удалить группу «${category}»?`,
                          description: `Будут удалены все шаблоны группы (${items.length} шт.). Действие необратимо и не отменяется через Ctrl+Z.`,
                          confirmLabel: "Удалить группу",
                          danger: true,
                        });
                        if (confirmed) void deletePaletteCategory(category);
                      }}
                      className="p-2 rounded-md text-neutral-400 hover:text-red-500 hover:bg-red-500/10
                           opacity-0 group-hover/cat:opacity-100 focus-visible:opacity-100 transition-all duration-200 shrink-0"
                      title={`Удалить группу «${category}»`}
                      aria-label={`Удалить группу «${category}»`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {isExpanded && (
                  <div className="grid gap-1.5 pl-1">
                    {items.map((item: PaletteItemType, index) => (
                      <PaletteItem key={`${category}-${item.id}-${index}`} item={item} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

