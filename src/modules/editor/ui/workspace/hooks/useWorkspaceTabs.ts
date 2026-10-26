import {openSceneGuarded} from "@/lib/editor/openScene";
import {useEditorStore} from "../../../model/editorStore";
import type {TabType} from "../lib/workspaceLayout";

/** Вкладки редактора: ключ активной (`recipes`, `editor` или `scene:<id>`) и переключение. */
export function useWorkspaceTabs(activeTab: TabType, setActiveTab: (tab: TabType) => void) {
  const scene = useEditorStore(s => s.scene);

  const activeTabKey = activeTab === "recipes"
    ? "recipes"
    : (scene ? `scene:${scene.id}` : "editor");

  /** Активирует вкладку по ключу — общий вход для клика и стрелок. */
  const activateTab = (key: string) => {
    if (key === "recipes") { setActiveTab("recipes"); return; }
    if (key === "editor") { setActiveTab("editor"); return; }

    const id = Number(key.slice("scene:".length));
    if (!Number.isFinite(id)) return;
    // Своя схема уже открыта — просто показываем холст.
    if (scene?.id === id) { setActiveTab("editor"); return; }
    // Чужая: вкладку переключаем только если переход состоялся (могли отказаться
    // из-за несохранённых правок).
    void openSceneGuarded(id).then(ok => { if (ok) setActiveTab("editor"); });
  };

  return {activeTabKey, activateTab};
}
