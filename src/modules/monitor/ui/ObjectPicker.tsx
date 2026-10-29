"use client";

import React, {useEffect, useId, useMemo, useRef, useState} from "react";
import {ChevronDown, Search} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {Input} from "@/shared/ui/field/Input";
import type {InspectorObjectDto} from "@/types/runtimeWrite.types";

const objectLabel = (o: InspectorObjectDto) => o.name ?? `#${o.id}`;

/** Совпадение по имени объекта или схемы, без учёта регистра. */
const matches = (o: InspectorObjectDto, q: string) =>
  (o.name ?? "").toLowerCase().includes(q) || (o.sceneName ?? "").toLowerCase().includes(q);

/**
 * Выбор объекта одним полем: пишешь — список под полем сразу фильтруется (по имени объекта и
 * схемы), выбор мышью или стрелками + Enter, Esc — закрыть. Пока поле не в фокусе, в нём виден
 * выбранный объект. Объектов в выпуске сотни, и пара «поле поиска + селект» заставляла сначала
 * печатать, потом отдельно раскрывать список.
 */
export function ObjectPicker({objects, selected, loading, onSelect}: {
  objects: InspectorObjectDto[];
  selected: InspectorObjectDto | null;
  loading: boolean;
  onSelect: (id: number) => void;
}) {
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? objects.filter(o => matches(o, q)) : objects;
  }, [objects, query]);

  // Подсвеченная строка всегда видна при листании стрелками.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({block: "nearest"});
  }, [active, open]);

  const choose = (o: InspectorObjectDto | undefined) => {
    if (!o) return;
    onSelect(o.id);
    setOpen(false);
    setQuery("");
  };

  const shown = open
    ? query
    : selected ? `${objectLabel(selected)}${selected.sceneName ? ` · ${selected.sceneName}` : ""}` : "";

  return (
    <div className="relative">
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <Input
        size="sm"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
        value={shown}
        disabled={loading && !objects.length}
        placeholder={loading && !objects.length ? "Загрузка…" : "Найти объект или схему"}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onBlur={() => setOpen(false)}
        onChange={e => { setQuery(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(filtered[active]); }
          else if (e.key === "Escape") { setOpen(false); setQuery(""); (e.target as HTMLInputElement).blur(); }
        }}
        className="pl-8 pr-8"
      />
      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover text-popover-foreground py-1 shadow-lg custom-scrollbar"
        >
          {filtered.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground italic">Ничего не найдено</li>
          )}
          {filtered.map((o, i) => (
            <li
              key={o.id}
              id={`${listId}-${o.id}`}
              data-index={i}
              role="option"
              aria-selected={o.id === selected?.id}
              // mousedown, а не click: иначе поле потеряет фокус и закроет список раньше выбора.
              onMouseDown={e => { e.preventDefault(); choose(o); }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex items-baseline gap-2 px-3 py-1.5 text-sm cursor-pointer",
                i === active && "bg-accent",
                o.id === selected?.id && "font-medium text-primary",
              )}
            >
              <span className="min-w-0 truncate">{objectLabel(o)}</span>
              {o.sceneName && <span className="ml-auto shrink-0 text-xs text-muted-foreground">{o.sceneName}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
