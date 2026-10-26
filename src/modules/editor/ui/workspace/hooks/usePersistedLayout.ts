import {useEffect, useState} from "react";
import {
  clamp, LEFT_COLLAPSE, LEFT_DEFAULT, LEFT_MAX, LEFT_TABS, type LeftTabType, MAIN_TABS, readLayout,
  RIGHT_COLLAPSE, RIGHT_DEFAULT, RIGHT_MAX, SAVE_DELAY, type TabType, writeLayout,
} from "../lib/workspaceLayout";

/** Раскладка редактора: ширины и свёрнутость панелей, активные вкладки — с сохранением. */
export function usePersistedLayout() {
  const [leftVisible, setLeftVisible] = useState(true);
  const [rightVisible, setRightVisible] = useState(true);
  const [leftTab, setLeftTab] = useState<LeftTabType>("palette");
  const [activeTab, setActiveTab] = useState<TabType>("editor");

  // Ширина боковых панелей — настраивается перетаскиванием края (см. usePanelResize).
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT);
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT);

  // Восстанавливаем раскладку после монтирования (localStorage недоступен на сервере,
  // поэтому не читаем его в useState-инициализаторе — это дало бы рассинхронизацию с SSR-разметкой).
  // Синхронный setState здесь оправдан: это единственный способ безопасно прочитать
  // браузерный API после монтирования, а не «выводимое» из пропсов состояние.
  useEffect(() => {
    const saved = readLayout();

    if (Number.isFinite(saved.leftWidth) && saved.leftWidth! > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeftWidth(clamp(saved.leftWidth!, LEFT_COLLAPSE, LEFT_MAX));
    }
    if (Number.isFinite(saved.rightWidth) && saved.rightWidth! > 0) {
      setRightWidth(clamp(saved.rightWidth!, RIGHT_COLLAPSE, RIGHT_MAX));
    }
    if (typeof saved.leftVisible === "boolean") setLeftVisible(saved.leftVisible);
    if (typeof saved.rightVisible === "boolean") setRightVisible(saved.rightVisible);
    if (LEFT_TABS.includes(saved.leftTab as LeftTabType)) setLeftTab(saved.leftTab!);
    if (MAIN_TABS.includes(saved.activeTab as TabType)) setActiveTab(saved.activeTab!);
  }, []);

  // Одна отложенная запись вместо синхронной на каждое изменение ширины.
  useEffect(() => {
    const id = setTimeout(() => {
      writeLayout({leftWidth, rightWidth, leftVisible, rightVisible, leftTab, activeTab});
    }, SAVE_DELAY);

    return () => clearTimeout(id);
  }, [leftWidth, rightWidth, leftVisible, rightVisible, leftTab, activeTab]);

  return {
    leftWidth, setLeftWidth, rightWidth, setRightWidth,
    leftVisible, setLeftVisible, rightVisible, setRightVisible,
    leftTab, setLeftTab, activeTab, setActiveTab,
  };
}

export type WorkspaceLayout = ReturnType<typeof usePersistedLayout>;
