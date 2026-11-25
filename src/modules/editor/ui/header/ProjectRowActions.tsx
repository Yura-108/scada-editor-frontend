'use client';

import React from 'react';
import { Button } from '@/shared/ui/Button';
import { confirmModal } from '@/shared/ui/dialog/confirmModal';
import { openAutobindModal } from '../project/OpenAutobindModal';
import type { EditorProject } from '@/core/project';
import { useEditorStore } from '../../model/editorStore';
import { openProcedureLevelsModal } from '../project/ProcedureLevelsModal';
import { openReleasesModal } from '../project/ReleasesModal';

/**
 * Кнопки строки в выборе проекта: уровни процедур, выпуски, эксплуатация, автопривязка,
 * удаление. Каждая ведёт к окну или подтверждению, поэтому сначала закрывает список
 * (`onClose`) — иначе окно открылось бы под ним.
 *
 * Права те же, что были в окне «Выберите проект»: уровни видны всем; выпуски, эксплуатация
 * и автопривязка — с правом правки (бэкенд: 403 NO_EDIT); удаление — только администратору.
 */
export function ProjectRowActions({
  project,
  canEdit,
  admin,
  inOperation,
  onClose,
}: {
  project: EditorProject;
  canEdit: boolean;
  admin: boolean;
  inOperation: boolean;
  onClose: () => void;
}) {
  const deleteProject = useEditorStore((s) => s.deleteProject);
  const setProjectInOperation = useEditorStore((s) => s.setProjectInOperation);

  const toggleOperation = async () => {
    onClose();
    if (inOperation) {
      // Вывод из эксплуатации гасит проект целиком: останавливаются серверные скрипты и
      // идущие процедуры (мойка прервётся на текущем шаге).
      const ok = await confirmModal({
        title: `Вывести «${project.name}» из эксплуатации?`,
        description:
          'Рантайм остановит проект: прекратятся обработчики изменений и идущие ' +
          'процедуры, мониторы этого проекта отключатся.',
        confirmLabel: 'Вывести',
        danger: true,
      });
      if (!ok) return;
    }
    await setProjectInOperation(project.id, !inOperation);
  };

  const remove = async () => {
    onClose();
    const ok = await confirmModal({
      title: `Удалить проект «${project.name}»?`,
      description: 'Проект и все его схемы со всеми элементами будут удалены. Действие необратимо.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok) await deleteProject(project.id);
  };

  return (
    <div className="mx-2 space-y-0.5 border-l border-border pb-2 pl-2">
      <Button
        size="sm"
        variant="ghost"
        className="w-full justify-start"
        onClick={() => {
          onClose();
          openProcedureLevelsModal(project.id, project.name, canEdit);
        }}
      >
        Уровни процедур
      </Button>
      {canEdit && (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onClose();
              openReleasesModal(project.id, project.name);
            }}
          >
            Выпуски проекта
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => void toggleOperation()}
          >
            {inOperation ? 'Вывести из эксплуатации' : 'Ввести в эксплуатацию'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start"
            onClick={() => {
              onClose();
              openAutobindModal(project.id, project.name);
            }}
          >
            Автопривязка к базе каналов
          </Button>
        </>
      )}
      {admin && (
        <div className="mt-1 border-t border-border pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="w-full justify-start text-destructive"
            onClick={() => void remove()}
          >
            Удалить проект
          </Button>
        </div>
      )}
    </div>
  );
}
