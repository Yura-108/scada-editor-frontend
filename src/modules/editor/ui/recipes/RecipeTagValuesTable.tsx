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
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60">
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800/80 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <th className={cn(headClass, "w-10")}>№</th>
            <th className={headClass}>Имя</th>
            <th className={headClass}>Тег</th>
            <th className={headClass}>Тип</th>
            <th className={headClass}>Описание</th>
            <th className={cn(headClass, "w-44")}>Значение</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800/70">
          {tags.map((tag, i) => {
            const text = step ? stepValueText(step, tag.name) : "";
            return (
              <tr key={tag.name}>
                <td className={cn(cellClass, "text-gray-400")}>{i + 1}</td>
                <td className={cn(cellClass, "font-medium text-gray-900 dark:text-gray-100")}>
                  {tag.name}
                </td>
                {/* Полный путь — в подсказке: в строку он не помещается. */}
                <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")} title={tag.tag}>
                  {shortTagPath(tag.tag)}
                </td>
                <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")}>
                  {tag.value_type
                    ? VALUE_TYPE_LABELS[tag.value_type] ?? tag.value_type
                    : <span className="italic text-gray-400">без проверки</span>}
                </td>
                <td className={cn(cellClass, "text-gray-500 dark:text-gray-400")}>
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
