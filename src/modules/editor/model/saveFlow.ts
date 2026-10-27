import type {SceneType} from "@/types/editorElement.type";
// переедет в core/scene вместе с остальным lib (шаг 8)
import {putScene} from "@/core/project";
import type {EditorState} from "./editorStore";
import {editorSession} from "./editorSession";
import {editorStore} from "./editorStoreRef";
import {applyServerComponents, rebaseHistoryIds} from "./editorStoreInternals";
import {resolvePendingPropertyRefs} from "./propertyRefs";

type EditorSet = (
  partial: Partial<EditorState> | ((state: EditorState) => Partial<EditorState>),
) => void;

/**
 * Общий замок сохранения и восстановления (`editorSession.saveInFlight`).
 *
 * Ждёт, пока отработает текущий, и только потом запускает `fn`. Между выходом из цикла и
 * присвоением замка нет `await`, поэтому два вызова не могут захватить его одновременно.
 * Сохранения сериализуются (иначе два параллельных запроса с id=null создадут дубли), а
 * восстановление не даёт летящему сохранению лечь на сервер после себя и откатить его.
 */
export async function withSaveLock(fn: () => Promise<boolean>): Promise<boolean> {
  while (editorSession.saveInFlight) {
    await editorSession.saveInFlight.catch(() => {});
  }

  const run = fn();
  editorSession.saveInFlight = run;
  try {
    return await run;
  } finally {
    if (editorSession.saveInFlight === run) editorSession.saveInFlight = null;
  }
}

/**
 * Подменяет холст тем, что лежит на сервере, — без шага undo.
 *
 * `tree` — дерево из ответа сервера, которому можно доверять (пришёл `version_no`): оно
 * ложится на холст и в кэш сцен. `null` — ответу не доверяем, сцена перечитывается
 * (`loadScene` с `keepHistory`: границу сцены не пересекаем). pause/resume — тот же приём,
 * что у addTags/editProperty для изменений, синхронизированных с сервером.
 */
export async function replaceCanvasFromServer(
  get: () => EditorState,
  scene: SceneType,
  projectId: number | null | undefined,
  tree: {components: Record<string, unknown>[]; version: number} | null,
): Promise<void> {
  const temporal = editorStore().temporal.getState();
  temporal.pause();
  try {
    if (tree) {
      applyServerComponents(tree.components, scene);
      if (projectId != null) {
        putScene(
          projectId,
          {...(scene as unknown as Record<string, unknown>), children: tree.components},
          tree.version,
        );
      }
    } else {
      await get().loadScene(Number(scene.id), {keepHistory: true});
    }
  } finally {
    editorStore().temporal.getState().resume();
  }
}

/**
 * Хвост успешного сохранения: холст получает серверное дерево (уже с id), ссылки на
 * свойства — номера, история undo — серверные id. При `keepView` (автосейв) выделение,
 * активная группа и состояния возвращаются по ключам — чтобы автосейв не «дёргал»
 * пользователя.
 */
export async function applySavedTree(
  get: () => EditorState,
  set: EditorSet,
  scene: SceneType,
  projectId: number | undefined,
  saved: {components: Record<string, unknown>[]; versionNo: number | null},
  keepView: boolean | undefined,
): Promise<void> {
  // Дерево из ответа заменяет elements серверным (уже с id) и сбрасывает
  // выделение/активную группу/состояния. При keepView (автосейв) снимаем их
  // до подмены и восстанавливаем по ключам после — чтобы автосейв не «дёргал»
  // пользователя. Подхватить серверные id обязательно: без них следующее
  // сохранение снова вставит дубли (вариант А).
  const prevSelected = keepView ? get().selectedIds : null;
  const prevActive = keepView ? get().activeGroupKey : null;
  const prevStates = keepView ? get().currentComponentStateByElementKey : null;

  // Берём дерево ИЗ ОТВЕТА, а не перезапрашиваем сцену: повторный GET мог
  // бы вернуть более свежую версию, чем та, чей version_no мы только что
  // записали в sceneVersion, — база разъехалась бы с холстом. Заодно
  // экономится round-trip на каждом сохранении.
  //
  // Условие на version_no не косметика: это признак того, что бэкенд
  // ответил по контракту. Пришёл ответ без номера версии — форму дерева
  // в нём никто не гарантировал, доверять ему холст нельзя, и мы уходим
  // в честную перезагрузку сцены.
  await replaceCanvasFromServer(
    get, scene, projectId,
    saved.versionNo != null && saved.components.length
      ? {components: saved.components, version: saved.versionNo}
      : null,
  );

  // История пережила сохранение — значит, откатиться можно и «за» точку сейва.
  // Снимки, снятые до сохранения, содержат id:null у новых элементов, и
  // следующее сохранение вставило бы их повторно (дубли на сервере).
  // Переносим присвоенные сервером id в стек по ключам.
  // Свойства только что получили серверные номера — раздаём их ссылкам,
  // которые адресовали свойство парой «ключ элемента + имя». До сохранения
  // номера не существовало, и рантайму ссылка была не видна.
  const withRefs = resolvePendingPropertyRefs(get().elements);
  if (withRefs !== get().elements) {
    const t = editorStore().temporal.getState();
    t.pause();
    set({elements: withRefs});
    t.resume();
  }

  rebaseHistoryIds(get().elements);

  if (keepView) {
    const keys = new Set(get().elements.map(el => el.key));
    set({
      selectedIds: (prevSelected ?? []).filter(k => keys.has(k)),
      activeGroupKey: prevActive && keys.has(prevActive) ? prevActive : null,
      currentComponentStateByElementKey: Object.fromEntries(
        Object.entries(prevStates ?? {}).filter(([k]) => keys.has(k)),
      ),
    });
  }
}
