"use client";

import React from "react";
import {LayoutGrid} from "lucide-react";
import {ThemeToggle} from "@/shared/ui/ThemeToggle";
import {ButtonsSection} from "./sections/ButtonsSection";
import {DialogsSection} from "./sections/DialogsSection";
import {FieldsSection} from "./sections/FieldsSection";
import {ListsSection} from "./sections/ListsSection";
import {MiscSection} from "./sections/MiscSection";
import {NavigationSection} from "./sections/NavigationSection";
import {StatusSection} from "./sections/StatusSection";
import {TonesSection} from "./sections/TonesSection";

const SECTIONS = [
  {id: "tones", label: "Тона"},
  {id: "buttons", label: "Кнопки"},
  {id: "fields", label: "Поля"},
  {id: "lists", label: "Списки"},
  {id: "status", label: "Статусы"},
  {id: "navigation", label: "Навигация"},
  {id: "dialogs", label: "Окна"},
  {id: "misc", label: "Прочее"},
];

/**
 * Каталог общих компонентов: всё, что есть в `shared/ui`, в обеих темах и размерах. Перед
 * новым компонентом — сюда: возможно, он уже есть. Новый компонент `shared/ui` добавляется
 * и в каталог (docs/architecture.md, «UI-kit: общие компоненты»). Данные выдуманные.
 */
export function UiCatalog() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-header flex h-12 items-center gap-3 overflow-x-auto border-b bg-card px-4">
        <LayoutGrid size={16} aria-hidden className="shrink-0 text-primary" />
        <h1 className="shrink-0 text-sm font-semibold">Каталог UI-kit</h1>
        <nav aria-label="Разделы каталога" className="flex gap-1 text-sm">
          {SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`} className="whitespace-nowrap rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
              {s.label}
            </a>
          ))}
        </nav>
        <div className="flex-1" />
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-7xl space-y-10 px-4 py-6">
        <TonesSection />
        <ButtonsSection />
        <FieldsSection />
        <ListsSection />
        <StatusSection />
        <NavigationSection />
        <DialogsSection />
        <MiscSection />
      </main>
    </div>
  );
}
