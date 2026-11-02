"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {useOpenScene} from "@/core/project";
import {sectionOf} from "../lib/navItems";

const APP_NAME = "SCADA";

/**
 * Заголовок вкладки браузера: «Монитор · Нормализация — SCADA». Без него вкладки разделов,
 * открытые по Ctrl+клику, на панели задач и в истории были неотличимы — виден был только адрес.
 *
 * Один компонент на всю рабочую область, а не по хуку в каждой странице: раздел берётся из
 * адреса, проект — из среза открытой сцены (`useOpenScene`; проект выбирают редактор, монитор,
 * «Автоматизация» и «Данные»). Срез регистрирует `EditorStoreBinding` в layout.
 */
export default function DocumentTitle() {
  const pathname = usePathname();
  const projectName = useOpenScene(s => s.currentProject?.name ?? null);

  useEffect(() => {
    const section = sectionOf(pathname);
    if (!section) {
      document.title = APP_NAME;
      return;
    }
    const project = section.projectScoped && projectName ? ` · ${projectName}` : "";
    document.title = `${section.name}${project} — ${APP_NAME}`;
  }, [pathname, projectName]);

  return null;
}
