"use client";

import React from "react";
import {Eye} from "lucide-react";

/**
 * Плашка режима «только просмотр» под панелью раздела. Раньше это была мелкая надпись справа
 * сверху, а поля оставались активными: пользователь правил то, что сохранить не мог.
 * Теперь формы раздела заблокированы, а здесь сказано, почему и к кому идти.
 */
export function ReadOnlyBanner({projectName}: {projectName: string}) {
  return (
    <div
      role="status"
      className="shrink-0 flex items-center gap-2 px-4 py-2 text-sm border-b border-sky-200 dark:border-sky-900/60 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-200"
    >
      <Eye size={16} className="shrink-0" />
      <span className="min-w-0">
        <b>Только просмотр.</b> В проекте «{projectName}» у вас нет права правки — изменения здесь недоступны.
        Права в проектах выдаёт администратор.
      </span>
    </div>
  );
}
