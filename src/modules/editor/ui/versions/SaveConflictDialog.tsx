'use client';

import { AlertTriangle } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';
import { useEditorStore } from '../../model/editorStore';
import { useSessionUserStore } from '@/core/access';
import { Button } from '@/shared/ui/Button';
import Modal from '@/shared/ui/dialog/Modal';
import {
  CONFLICT_KIND_LABEL,
  formatConflictEntity,
  formatConflictPath,
  SCENE_ORDER_CONFLICT_PATH,
} from './formatVersion';
import { conflictColumns, type ConflictLine } from '../../lib/conflictValues';

function ConflictValue({
  label,
  lines,
  className,
}: {
  label: string;
  lines: ConflictLine[];
  className: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 font-medium text-muted-foreground">{label}</dt>
      <dd className={`[overflow-wrap:anywhere] ${className}`}>
        {lines.length
          ? lines.map((line, i) => (
              <div key={i} title={line.title}>
                {line.text}
              </div>
            ))
          : '—'}
      </dd>
    </div>
  );
}

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
  const login = useSessionUserStore((s) => s.login);
  const { saveConflict, dismissSaveConflict, saveOverConflict, previewVersion } = useEditorStore(
    useShallow((s) => ({
      saveConflict: s.saveConflict,
      dismissSaveConflict: s.dismissSaveConflict,
      saveOverConflict: s.saveOverConflict,
      previewVersion: s.previewVersion,
    })),
  );

  if (!saveConflict) return null;

  const { error, base_version, current_version, conflicts } = saveConflict;
  const rows = conflicts ?? [];

  const ownChanges = Boolean(login && rows.length && rows.every((row) => row.their_user === login));
  const title = ownChanges
    ? 'Ваши правки пересеклись с сохранением из другой вкладки'
    : error === 'merge_conflict'
      ? 'В схеме есть пересекающиеся правки'
      : 'На сервере появилась новая версия схемы';

  return (
    <Modal
      open
      onClose={dismissSaveConflict}
      size="xl"
      icon={<AlertTriangle className="mt-1 shrink-0 text-warning" size={20} />}
      title={title}
      description={
        <>
          Вы правили версию {base_version ?? '—'}, а на сервере уже версия {current_version ?? '—'}.
          Ваши изменения не потеряны — они остались на холсте.
        </>
      }
      footer={
        <>
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
          <Button
            variant="primary"
            onClick={() => {
              void saveOverConflict();
            }}
          >
            Сохранить поверх
          </Button>
        </>
      }
    >
      {rows.length ? (
        <ul className="space-y-3 text-sm">
          {rows.map((c, i) => {
            const values = conflictColumns(c.base, c.yours, c.theirs);
            const sameUser = Boolean(login && c.their_user === login);
            const entity =
              c.path === SCENE_ORDER_CONFLICT_PATH
                ? 'порядок верхнего уровня'
                : formatConflictEntity(c.entity);
            const kind =
              sameUser && c.kind === 'DELETED_BY_THEM'
                ? 'Удалено в другой вкладке'
                : (CONFLICT_KIND_LABEL[c.kind] ?? c.kind);
            return (
              <li key={`${c.path}-${i}`} className="rounded-md border border-border p-3">
                <div className="font-medium [overflow-wrap:anywhere]">
                  {formatConflictPath(c.path)}
                </div>
                <div className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {entity} · {kind}
                  {c.their_user ? ` · ${c.their_user}` : ''}
                </div>
                <dl className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
                  <ConflictValue
                    label="Было"
                    lines={values.base}
                    className="text-muted-foreground"
                  />
                  <ConflictValue
                    label="У вас"
                    lines={values.yours}
                    className="font-medium text-success"
                  />
                  <ConflictValue
                    label={sameUser ? 'В другой вкладке' : 'На сервере'}
                    lines={values.theirs}
                    className="font-medium text-info"
                  />
                </dl>
              </li>
            );
          })}
        </ul>
      ) : (
        // Список расхождений появится, когда на бэкенде включится слияние. До тех
        // пор честнее сказать «мы не знаем, что именно разошлось», чем молчать.
        <p className="text-sm text-muted-foreground">
          Список расхождений сервер не прислал. Откройте версию {current_version ?? '—'}, чтобы
          сравнить, и решите: сохранить своё поверх или отказаться и перенести правки вручную.
        </p>
      )}
    </Modal>
  );
}
