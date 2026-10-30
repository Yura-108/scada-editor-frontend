"use client";

import React from "react";
import {Gauge, Link2, Power, PowerOff, Rocket, X} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {IconButton} from "@/shared/ui/IconButton";
import {confirmModal} from "@/shared/ui/dialog/confirmModal";
import {openAutobindModal} from "@/components/ui/OpenAutobindModal";
import type {EditorProject} from "@/core/project";
import {useEditorStore} from "../../model/editorStore";
import {openProcedureLevelsModal} from "../project/ProcedureLevelsModal";
import {openReleasesModal} from "../project/ReleasesModal";

/**
 * Кнопки строки в выборе проекта: уровни процедур, выпуски, эксплуатация, автопривязка,
 * удаление. Каждая ведёт к окну или подтверждению, поэтому сначала закрывает список
 * (`onClose`) — иначе окно открылось бы под ним.
 *
 * Права те же, что были в окне «Выберите проект»: уровни видны всем; выпуски, эксплуатация
 * и автопривязка — с правом правки (бэкенд: 403 NO_EDIT); удаление — только администратору.
 */
export function ProjectRowActions({project, canEdit, admin, inOperation, onClose}: {
  project: EditorProject;
  canEdit: boolean;
  admin: boolean;
  inOperation: boolean;
  onClose: () => void;
}) {
  const deleteProject = useEditorStore(s => s.deleteProject);
  const setProjectInOperation = useEditorStore(s => s.setProjectInOperation);

  const toggleOperation = async () => {
    onClose();
    if (inOperation) {
      // Вывод из эксплуатации гасит проект целиком: останавливаются серверные скрипты и
      // идущие процедуры (мойка прервётся на текущем шаге).
      const ok = await confirmModal({
        title: `Вывести «${project.name}» из эксплуатации?`,
        description: "Рантайм остановит проект: прекратятся обработчики изменений и идущие "
          + "процедуры, мониторы этого проекта отключатся.",
        confirmLabel: "Вывести",
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
      description: "Проект и все его схемы со всеми элементами будут удалены. Действие необратимо.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (ok) await deleteProject(project.id);
  };

  return (
    <>
      <IconButton
        icon={Gauge}
        size="xs"
        title="Уровни доступа операций процедур"
        label={`Уровни процедур проекта «${project.name}»`}
        onClick={() => { onClose(); openProcedureLevelsModal(project.id, project.name, canEdit); }}
      />
      {canEdit && <>
        <IconButton
          icon={Rocket}
          size="xs"
          title="Выпуски проекта: выпустить черновик, сделать prod"
          label={`Выпуски проекта «${project.name}»`}
          onClick={() => { onClose(); openReleasesModal(project.id, project.name); }}
        />
        <IconButton
          icon={inOperation ? Power : PowerOff}
          size="xs"
          aria-pressed={inOperation}
          className={cn(inOperation && "text-success enabled:hover:text-success")}
          title={inOperation
            ? "В эксплуатации: рантайм исполняет проект. Нажмите, чтобы вывести"
            : "Не в эксплуатации: рантайм проект не исполняет. Нажмите, чтобы ввести"}
          label={inOperation
            ? `Вывести проект «${project.name}» из эксплуатации`
            : `Ввести проект «${project.name}» в эксплуатацию`}
          onClick={() => void toggleOperation()}
        />
        <IconButton
          icon={Link2}
          size="xs"
          title="Автопривязка к базе каналов"
          label={`Автопривязка проекта «${project.name}» к базе каналов`}
          onClick={() => { onClose(); openAutobindModal(project.id, project.name); }}
        />
      </>}
      {admin && (
        <IconButton
          icon={X}
          size="xs"
          variant="danger"
          title="Удалить проект"
          label={`Удалить проект «${project.name}»`}
          onClick={() => void remove()}
        />
      )}
    </>
  );
}
