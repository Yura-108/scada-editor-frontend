import {create} from "zustand";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "@/store/useEditorStore";

/**
 * Последнее уведомление `SCENE_CHANGED` из STOMP редактора (`/topic/scenes/{sceneId}`):
 * сцену сохранили, на сервере новая версия. Это уведомление, не синхронизация — правки в
 * открытый редактор сами не подмешиваются (контракт: docs/contract/2026-10-16-frontend-open-tasks.md, п. 3).
 *
 * Сброса при смене документа нет и не нужно: видимость ВЫЧИСЛЯЕТСЯ (`visibleSceneChange`) —
 * уведомление о другой сцене или о версии, которую холст уже догнал, просто не показывается.
 */
export interface SceneChangeNotice {
  sceneId: number;
  versionNo: number;
  userName: string;
}

interface SceneChangeState {
  notice: SceneChangeNotice | null;
  /** Версия, плашку о которой человек скрыл; более новая покажется снова. */
  dismissedVersion: number | null;
  receive: (notice: SceneChangeNotice) => void;
  dismiss: () => void;
}

export const useSceneChangeStore = create<SceneChangeState>((set, get) => ({
  notice: null,
  dismissedVersion: null,
  receive: notice => {
    // Сообщения могут прийти не по порядку (переподключение) — старая версия новую не вытесняет.
    const prev = get().notice;
    if (prev && prev.sceneId === notice.sceneId && prev.versionNo >= notice.versionNo) return;
    set({notice});
  },
  dismiss: () => set({dismissedVersion: get().notice?.versionNo ?? null}),
}));

/**
 * Уведомление, которое надо показать, или `null`.
 *
 * Своё сохранение отсеивается сравнением с `sceneVersion`: успешный `PUT` записывает туда
 * версию из ответа, и сообщение с тем же (или меньшим) номером — наше или уже учтённое.
 * Пока сохранение в полёте, не показываем ничего: сообщение о нашей же записи может прийти
 * раньше ответа на `PUT`, когда `sceneVersion` ещё старый. Если запись оказалась чужой,
 * плашка появится, как только сохранение закончится.
 */
export function visibleSceneChange(
  notice: SceneChangeNotice | null,
  dismissedVersion: number | null,
  editor: {sceneId: number | null; sceneVersion: number | null; isSaving: boolean; isDraft: boolean},
): SceneChangeNotice | null {
  if (!notice || !editor.isDraft || editor.isSaving) return null;
  if (editor.sceneId !== notice.sceneId) return null;
  if (editor.sceneVersion != null && notice.versionNo <= editor.sceneVersion) return null;
  if (dismissedVersion != null && notice.versionNo <= dismissedVersion) return null;
  return notice;
}

export function useVisibleSceneChange(): SceneChangeNotice | null {
  const {notice, dismissedVersion} = useSceneChangeStore(
    useShallow(s => ({notice: s.notice, dismissedVersion: s.dismissedVersion})),
  );
  const editor = useEditorStore(
    useShallow(s => ({
      sceneId: s.scene?.id != null ? Number(s.scene.id) : null,
      sceneVersion: s.sceneVersion,
      isSaving: s.isSaving,
      isDraft: s.sceneSource === "draft",
    })),
  );
  return visibleSceneChange(notice, dismissedVersion, editor);
}
