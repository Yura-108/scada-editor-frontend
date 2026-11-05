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
    const project = section?.projectScoped && projectName ? ` · ${projectName}` : "";
    const title = section ? `${section.name}${project} — ${APP_NAME}` : APP_NAME;
    const apply = () => { if (document.title !== title) document.title = title; };
    apply();

    // После F5 Next присылает `<title>` из metadata корневого layout позже этого эффекта и
    // затирает заголовок, а эффект не перезапускается — адрес и проект те же (#12 п. 1).
    // Возвращаем свой, когда `<head>` меняется; ставим только при отличии, так что без цикла.
    const observer = new MutationObserver(apply);
    observer.observe(document.head, {childList: true, subtree: true, characterData: true});
    return () => observer.disconnect();
  }, [pathname, projectName]);

  return null;
}
