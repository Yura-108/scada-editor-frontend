"use client";

import {AlertTriangle} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {useEditorStore} from "../../model/editorStore";
import {Button} from "@/shared/ui/Button";
import Modal from "@/shared/ui/dialog/Modal";
import {
  CONFLICT_KIND_LABEL,
  formatConflictPath,
  SCENE_ORDER_CONFLICT_PATH,
} from "./formatVersion";

/**
 * Диалог расхождения версий (ответ 409 на сохранение).
 *
 * Одна реализация на два случая контракта — и это намеренно:
 *  - пока на бэкенде только проверка версии, приходит `version_mismatch` БЕЗ списка
 *    расхождений;
 *  - когда включится трёхстороннее слияние — `merge_conflict` со списком.
 * Разрешение с нашей стороны одинаковое: показать, что разошлось, дать человеку
 * решить и сохранить заново от текущей версии. Отдельного эндпоинта для этого нет.
 *
 * Чего диалог НЕ делает: не трогает холст. Правки пользователя остаются на месте и
 * помечены несохранёнными — закрытие диалога ничего не теряет.
 */
export default function SaveConflictDialog() {
  const {saveConflict, dismissSaveConflict, saveOverConflict, previewVersion} = useEditorStore(
    useShallow(s => ({
      saveConflict: s.saveConflict,
      dismissSaveConflict: s.dismissSaveConflict,
      saveOverConflict: s.saveOverConflict,
      previewVersion: s.previewVersion,
    })),
  );

  if (!saveConflict) return null;

  const {error, base_version, current_version, conflicts} = saveConflict;
  const rows = conflicts ?? [];

  // Два разных повода для 409, и человеку они говорят разное: «версия разошлась» —
  // сервер даже не пытался слить (POST, автосейв, шаблон), «правки пересеклись» —
  // пытался и не смог. Действия одинаковые, формулировка нет.
  const title = error === "merge_conflict"
    ? "Ваши правки пересеклись с чужими"
    : "Схему изменил другой пользователь";

  return (
    <Modal
      open
      onClose={dismissSaveConflict}
      size="xl"
      icon={<AlertTriangle className="mt-1 shrink-0 text-warning" size={20} />}
      title={title}
      description={<>
        Вы правили версию {base_version ?? "—"}, а на сервере уже версия {current_version ?? "—"}.
        Ваши изменения не потеряны — они остались на холсте.
      </>}
      footer={<>
        <Button onClick={dismissSaveConflict}>Отмена</Button>
        {current_version != null && (
          <Button
            onClick={() => {
              // Просмотр чужой версии откладывает наши правки в сторону и вернёт их
              // при выходе — сравнить можно, не рискуя работой.
              dismissSaveConflict();
              void previewVersion(current_version);
            }}
          >
            Посмотреть версию {current_version}
          </Button>
        )}
        <Button variant="primary" onClick={() => { void saveOverConflict(); }}>
          Сохранить поверх
        </Button>
      </>}
    >
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead className="text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="py-2 pr-3 font-medium">Что</th>
                <th className="py-2 pr-3 font-medium">Расхождение</th>
                <th className="py-2 pr-3 font-medium">Было</th>
                <th className="py-2 pr-3 font-medium">У вас</th>
                <th className="py-2 pr-3 font-medium">У них</th>
                <th className="py-2 font-medium">Кто</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={`${c.path}-${i}`} className="border-b border-neutral-100 dark:border-neutral-800/60">
                  <td className="py-2 pr-3">
                    <div className="font-medium">{formatConflictPath(c.path)}</div>
                    <div className="text-neutral-500">
                      {/* `path === "Сцена"` — не компонент с таким именем, а
                          зарезервированный адрес порядка корней сцены. Показывать
                          рядом с ним «component» значило бы отправить человека
                          искать несуществующий компонент. */}
                      {c.path === SCENE_ORDER_CONFLICT_PATH
                        ? "порядок верхнего уровня"
                        : c.entity}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{CONFLICT_KIND_LABEL[c.kind] ?? c.kind}</td>
                  <td className="py-2 pr-3 text-neutral-500">{c.base ?? "—"}</td>
                  <td className="py-2 pr-3 font-medium text-emerald-700 dark:text-emerald-400">{c.yours ?? "—"}</td>
                  <td className="py-2 pr-3 font-medium text-sky-700 dark:text-sky-400">{c.theirs ?? "—"}</td>
                  <td className="py-2 text-neutral-500">{c.their_user ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        // Список расхождений появится, когда на бэкенде включится слияние. До тех
        // пор честнее сказать «мы не знаем, что именно разошлось», чем молчать.
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Список расхождений сервер не прислал. Откройте версию {current_version ?? "—"},
          чтобы сравнить, и решите: сохранить своё поверх или отказаться и перенести
          правки вручную.
        </p>
      )}
    </Modal>
  );
}
