"use client";

import React, {useState} from "react";
import {cn} from "@/shared/lib/cn";
import {PortalContainerProvider} from "@/shared/ui/portalContainer";

/**
 * Раздел каталога: одно и то же содержимое в светлой и тёмной колонке. Колонки задают тему
 * классом (`.light` / `.dark` переопределяют токены), поэтому видны обе сразу, какая бы ни
 * была у страницы. Выпадающие списки открываются внутри своей колонки; окна — в корне
 * страницы и берут её тему, её переключает кнопка в шапке каталога.
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

/**
 * Колонка — ещё и контейнер портала для выпадающих списков: так их меню лежит внутри
 * `.light`/`.dark` и берёт тему колонки. Окна (`ModalRoot`) рисуются в корне — у них тема страницы.
 */
function ThemeColumn({theme, children}: {theme: "light" | "dark"; children: React.ReactNode}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  return (
    <div ref={setContainer} className={cn(theme, "min-w-0 rounded-xl border bg-background p-4 text-foreground")}>
      <div className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">
        {theme === "light" ? "Светлая тема" : "Тёмная тема"}
      </div>
      <PortalContainerProvider container={container}>
        <div className="space-y-5">{children}</div>
      </PortalContainerProvider>
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
