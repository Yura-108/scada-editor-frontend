"use client";

import {useEffect} from "react";
import {usePaletteStore} from "@/store/usePaletteStore";
import {useAutoSaveScene, useWarnOnUnsavedChanges} from "@/lib/useAutoSaveScene";
import {useSceneChangedNotifications, useEditorStore, WorkSpace, restoreLastProject} from "@/modules/editor";
import {useSessionUserStore, canOpenInEditor, grantOf} from "@/core/access";
import {toast} from "sonner";

export default function EditorPage() {
  // Точечный селектор: подписка на весь стор палитры перерисовывала страницу
  // редактора при любой её загрузке/правке.
  const loadPaletteItems = usePaletteStore(s => s.loadPaletteItems);

  // Автосохранение раз в 10 минут (только при изменениях, тихо, без сброса выделения)
  // + предупреждение при закрытии вкладки с несохранённой схемой.
  useAutoSaveScene();
  useWarnOnUnsavedChanges();
  // «Сцену сохранил другой инженер» — STOMP /ws/editor, подписка на открытую сцену.
  useSceneChangedNotifications();

  // Ctrl+Z / Ctrl+Y / Ctrl+G раньше жили здесь отдельным реестром без проверки
  // contentEditable, поэтому срабатывали внутри редактора скриптов (CodeMirror).
  // Теперь все хоткеи редактора — в useEditorHotkeys (см. Canvas).

  // Список проектов несёт права (`access`). Проект мог остаться выбранным из монитора, где
  // хватает одного «управления», — в редакторе такой проект не открывается (403), поэтому
  // сбрасываем его, как только узнали права.
  useEffect(() => {
    let cancelled = false;
    void useEditorStore.getState().loadProjectList().then(projects => {
      if (cancelled || !projects) return;
      const {currentProject, setCurrentProject} = useEditorStore.getState();
      const admin = useSessionUserStore.getState().admin;
      if (!currentProject) {
        // После перезагрузки — последний проект, если он открывается в редакторе. Схему не
        // открываем: выбор схемы остаётся за инженером, вкладки закреплённых схем видны и так.
        restoreLastProject(projects.filter(p => canOpenInEditor(grantOf(p, admin))));
        const restored = useEditorStore.getState().currentProject;
        if (restored) void useEditorStore.getState().loadSceneList(restored.id);
        return;
      }
      const project = projects.find(p => p.id === currentProject.id);
      if (!canOpenInEditor(grantOf(project, admin))) {
        setCurrentProject(null);
        toast.info(`Проект «${currentProject.name}» недоступен в редакторе — нет права просмотра или правки`);
      }
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    // Палитра подгружается автоматически при монтировании, если ещё не загружена.
    loadPaletteItems();
  }, [loadPaletteItems]);

  return (
    <div className="h-screen w-full flex flex-col bg-neutral-50 dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 overflow-hidden">
      {/* Элементы добавляются кликом: клик по элементу палитры «вооружает» инструмент,
          клик по холсту ставит элемент (см. Canvas.handleStagePlacementClick). */}
      <WorkSpace />
    </div>
  );
}
