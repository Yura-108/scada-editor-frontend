"use client";

import React from "react";
import {FolderOpen, Lock} from "lucide-react";
import type {EditorProject} from "@/core/project";
import {EmptyState} from "@/shared/ui/EmptyState";
import {Spinner} from "@/shared/ui/Spinner";

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
  if (!listLoaded) return <Spinner label="Загрузка…" fill />;

  let icon = FolderOpen;
  let title = "Выберите проект";
  let text: React.ReactNode = "Проект выбирается в списке на панели сверху.";

  if (unavailable) {
    icon = Lock;
    title = `Проект «${unavailable.name}» недоступен в этом разделе`;
    text = <>
      Здесь нужно право просмотра или правки проекта, а у вас его нет (хватает только для монитора).
      Права в проектах выдаёт администратор.
      {projectCount > 0 && <> Можно выбрать другой проект на панели сверху.</>}
    </>;
  } else if (projectCount === 0) {
    icon = Lock;
    title = "Нет доступных проектов";
    text = "У вас нет права просмотра или правки ни в одном проекте. Права в проектах выдаёт администратор.";
  }

  return <EmptyState icon={icon} title={title} description={text} />;
}
