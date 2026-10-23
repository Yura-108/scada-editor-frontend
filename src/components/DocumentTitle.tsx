"use client";

import {useEffect} from "react";
import {usePathname} from "next/navigation";
import {useEditorStore} from "@/modules/editor";
import {sectionOf} from "@/components/editor/navItems";

const APP_NAME = "SCADA";

/**
 * Заголовок вкладки браузера: «Монитор · Нормализация — SCADA». Без него вкладки разделов,
 * открытые по Ctrl+клику, на панели задач и в истории были неотличимы — виден был только адрес.
 *
 * Один компонент на всю рабочую область, а не по хуку в каждой странице: раздел берётся из
 * адреса, проект — из общего стора (его же выбирают редактор, монитор, «Автоматизация» и «Данные»).
 */
export default function DocumentTitle() {
  const pathname = usePathname();
  const projectName = useEditorStore(s => s.currentProject?.name ?? null);

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
