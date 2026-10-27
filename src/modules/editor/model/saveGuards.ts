import {toast} from "sonner";
import type {EditorState} from "./editorStore";
import {invalidProperties, sceneBelongsToCurrentProject} from "./editorStoreInternals";

/**
 * Можно ли сохранять сцену прямо сейчас. Возвращает числовой id сцены или `null` — тогда
 * причина уже показана тостом (кроме `silent`: автосейв молча пропускает тик).
 */
export function checkBeforeSave(state: EditorState, silent: boolean | undefined): number | null {
  const {elements, scene, currentProject, versionPreview} = state;

  if (!sceneBelongsToCurrentProject(scene, currentProject)) {
    if (!silent) toast.error("Сцена не принадлежит выбранному проекту");
    return null;
  }

  // Свойства теперь уезжают вместе со сценой, поэтому одно незаполненное
  // роняет сохранение ЦЕЛИКОМ («Property value_type is required for '…'»).
  // Бэкенд называет только имя свойства — говорим сами, у какого элемента
  // искать, и не тратим круг до сервера.
  const invalid = invalidProperties(elements);
  if (invalid.length) {
    if (!silent) {
      toast.error("Свойство заполнено не полностью", {
        description: invalid.slice(0, 5).join("; ")
          + (invalid.length > 5 ? ` и ещё ${invalid.length - 5}` : ""),
        duration: 8_000,
      });
    }
    return null;
  }

  // В режиме просмотра на холсте лежит СТАРАЯ версия. Сохранить её значит
  // затереть текущую сцену чужим прошлым — молча и необратимо. Автосейв сюда
  // приходит без участия человека, поэтому проверка именно здесь, а не в UI.
  if (versionPreview) {
    if (!silent) toast.error("Идёт просмотр версии — сохранение недоступно");
    return null;
  }

  // `scene_id` обязателен в конверте `PUT`: тело описывает состав ИМЕННО этой
  // сцены. Без числового id сохранять нельзя — сервер не поймёт, чей состав
  // ему прислали, а угадывать здесь опаснее всего: тело читается как «вот
  // сцена целиком», и промах адресом стёр бы чужую сцену.
  const sceneId = Number(scene?.id);
  if (!Number.isSafeInteger(sceneId)) {
    if (!silent) toast.error("Сцена не сохранена на сервере — сохранять состав нечему");
    return null;
  }

  return sceneId;
}
