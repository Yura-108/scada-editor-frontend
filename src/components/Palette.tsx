"use client";

import { useState } from "react";
import { paletteItems } from "@/constants/palette";
import PaletteItem from "./PaletteItem";
import {Search, X} from "lucide-react";
import {filterPalette, groupPalette, sortCategories} from "@/lib/palette-utils";

export default function Palette() {
  const [search, setSearch] = useState("");

  const filtered = filterPalette(paletteItems, search);
  const grouped = groupPalette(filtered);
  const sortedCategories = sortCategories(grouped);

  return (
    <div className="h-full flex flex-col bg-neutral-950/70 border-r border-neutral-800">
      {/* Поиск */}
      <div className="p-4 pb-3 border-b border-neutral-800 shrink-0">
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
              w-full bg-neutral-900/70 border border-neutral-700 rounded-lg
              pl-10 pr-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500
              focus:outline-none focus:border-neutral-600 focus:ring-1 focus:ring-neutral-600/50
              transition-all
            `}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Список */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5 custom-scrollbar">
        {sortedCategories.length === 0 ? (
          <div className="text-center text-neutral-500 text-sm py-10">
            Ничего не найдено
          </div>
        ) : (
          sortedCategories.map((category) => (
            <div key={category} className="space-y-2.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400 px-1">
                {category}
              </h3>

              <div className="grid gap-1.5">
                {grouped[category].map((item) => (
                  <PaletteItem key={item.type} item={item} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}