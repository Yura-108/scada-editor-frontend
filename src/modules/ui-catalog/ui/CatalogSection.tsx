"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";

/**
 * Раздел каталога: одно и то же содержимое в светлой и тёмной колонке. Колонки задают тему
 * классом (`.light` / `.dark` переопределяют токены), поэтому видны обе сразу, какая бы ни
 * была у страницы. Списки, поповеры и окна открываются в портале у `body` — они берут тему
 * страницы, её переключает кнопка в шапке каталога.
 */
export function CatalogSection({id, title, description, children}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-16 space-y-3">
      <header>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <ThemeColumn theme="light">{children}</ThemeColumn>
        <ThemeColumn theme="dark">{children}</ThemeColumn>
      </div>
    </section>
  );
}

function ThemeColumn({theme, children}: {theme: "light" | "dark"; children: React.ReactNode}) {
  return (
    <div className={cn(theme, "min-w-0 rounded-xl border bg-background p-4 text-foreground")}>
      <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        {theme === "light" ? "Светлая тема" : "Тёмная тема"}
      </div>
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Подпись к группе примеров внутри раздела. */
export function Demo({label, className, children}: {label: string; className?: string; children: React.ReactNode}) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
    </div>
  );
}
