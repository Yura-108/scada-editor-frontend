"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {Select} from "@/shared/ui/field/Select";

/**
 * Выбор проекта в шапке раздела (монитор, автоматизация, данные). Что делать с выбором —
 * спросить про несохранённое, перечитать данные — решает раздел (`onChange`).
 */
export function ProjectSelect({projects, value, onChange, labelOf, className}: {
  projects: {id: number; name: string}[];
  value: number | null | undefined;
  onChange: (id: number) => void;
  /** Подпись пункта; по умолчанию — имя проекта. */
  labelOf?: (project: {id: number; name: string}) => string;
  className?: string;
}) {
  return (
    <Select
      size="sm"
      className={cn("min-w-0 max-w-48 shrink", className)}
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onChange(Number(v))}
      placeholder="Проект…"
      options={projects.map(p => ({value: String(p.id), label: labelOf ? labelOf(p) : p.name}))}
    />
  );
}
