"use client";

import React from "react";
import {FolderOpen, Lock} from "lucide-react";
import type {EditorProject} from "@/core/project";

interface Props {
  listLoaded: boolean;
  /** Сколько проектов доступно разделу. */
  projectCount: number;
  /** Проект выбран (например, в мониторе), но в этом разделе прав на него нет. */
  unavailable: EditorProject | null;
}

/**
 * Что показать вместо раздела, пока проект не выбран. Раньше здесь был пустой список
 * «Проект…» без объяснений — и непонятно, нет проектов вовсе или нет прав.
 */
export function ProjectPlaceholder({listLoaded, projectCount, unavailable}: Props) {
  let icon = <FolderOpen className="h-7 w-7" />;
  let title = "Выберите проект";
  let text: React.ReactNode = "Проект выбирается в списке на панели сверху.";

  if (!listLoaded) {
    title = "Загрузка…";
    text = null;
  } else if (unavailable) {
    icon = <Lock className="h-7 w-7" />;
    title = `Проект «${unavailable.name}» недоступен в этом разделе`;
    text = <>
      Здесь нужно право просмотра или правки проекта, а у вас его нет (хватает только для монитора).
      Права в проектах выдаёт администратор.
      {projectCount > 0 && <> Можно выбрать другой проект на панели сверху.</>}
    </>;
  } else if (projectCount === 0) {
    icon = <Lock className="h-7 w-7" />;
    title = "Нет доступных проектов";
    text = "У вас нет права просмотра или правки ни в одном проекте. Права в проектах выдаёт администратор.";
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="max-w-md text-center text-neutral-600 dark:text-neutral-400">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-500/10 text-neutral-500 dark:text-neutral-400">
          {icon}
        </div>
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{title}</h2>
        {text && <p className="mt-2 text-sm">{text}</p>}
      </div>
    </div>
  );
}
