"use client";

import { useState } from "react";
import PaletteItem from "./PaletteItem";
import {Search, X, ChevronDown} from "lucide-react";
import {filterPalette, groupPalette, sortCategories} from "@/lib/palette-utils";
import {PaletteItemType} from "@/types/palette.types";
import {usePaletteStore} from "@/store/usePaletteStore";

export default function Palette() {
  const {paletteItems} = usePaletteStore();
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
              pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500
              focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/50
              transition-all
            `}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
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
            
            return (
              <div key={category} className="space-y-2">
                <button
                  onClick={() => !isSearchActive && toggleCategory(category)}
                  disabled={isSearchActive}
                  className="w-full flex items-center gap-2 px-1 py-1.5 rounded-md transition-all hover:bg-neutral-100 dark:bg-neutral-800/50 disabled:hover:bg-transparent"
                >
                  <ChevronDown
                    size={16}
                    className={`text-neutral-500 transition-transform shrink-0 ${
                      isExpanded ? "" : "-rotate-90"
                    }`}
                  />
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-400 text-left">
                    {category}
                  </h3>
                  <span className="ml-auto text-xs text-neutral-600">
                    {grouped[category].length}
                  </span>
                </button>

                {isExpanded && (
                  <div className="grid gap-1.5 pl-1">
                    {grouped[category].map((item: PaletteItemType) => (
                      <PaletteItem key={item.id} item={item} />
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

