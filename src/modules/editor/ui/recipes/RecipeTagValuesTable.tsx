"use client";

import React from "react";
import {cn} from "@/shared/lib/cn";
import {shortTagPath} from "@/core/scene";
import type {RecipeStep, RecipeTag} from "@/core/project";
import {stepValueText} from "../../lib/recipeSteps";
import {RecipeValueCell} from "./RecipeValueCell";
import {cellClass, headClass} from "./tableClasses";

const VALUE_TYPE_LABELS: Record<string, string> = {
  number: "число",
  bool: "логический",
  string: "строка",
};

/** Теги рецепта и их значения на выбранном шаге: пустое значение — тег на шаге не пишется. */
export function RecipeTagValuesTable({tags, step, onChange}: {
  tags: RecipeTag[];
  step: RecipeStep | undefined;
  onChange: (tagName: string, text: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card dark:bg-card/60">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-muted dark:bg-muted/80 text-xs uppercase tracking-wider text-muted-foreground">
            <th className={cn(headClass, "w-10")}>№</th>
            <th className={headClass}>Имя</th>
            <th className={headClass}>Тег</th>
            <th className={headClass}>Тип</th>
            <th className={headClass}>Описание</th>
            <th className={cn(headClass, "w-44")}>Значение</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tags.map((tag, i) => {
            const text = step ? stepValueText(step, tag.name) : "";
            return (
              <tr key={tag.name}>
                <td className={cn(cellClass, "text-muted-foreground")}>{i + 1}</td>
                <td className={cn(cellClass, "font-medium text-foreground")}>
                  {tag.name}
                </td>
                {/* Полный путь — в подсказке: в строку он не помещается. */}
                <td className={cn(cellClass, "text-muted-foreground")} title={tag.tag}>
                  {shortTagPath(tag.tag)}
                </td>
                <td className={cn(cellClass, "text-muted-foreground")}>
                  {tag.value_type
                    ? VALUE_TYPE_LABELS[tag.value_type] ?? tag.value_type
                    : <span className="italic text-muted-foreground">без проверки</span>}
                </td>
                <td className={cn(cellClass, "text-muted-foreground")}>
                  {tag.description || "—"}
                </td>
                <td className={cellClass}>
                  <RecipeValueCell
                    valueType={tag.value_type}
                    text={text}
                    onChange={(v) => onChange(tag.name, v)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
