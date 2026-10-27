"use client";

import React from "react";
import {Gauge, Link2, Power, PowerOff, Rocket, X} from "lucide-react";
import {useShallow} from "zustand/react/shallow";
import {cn} from "@/shared/lib/cn";
import {grantOf} from "@/lib/access/projectAccess";
import {confirmModal} from "@/components/ui/ConfirmModal";
import {openAutobindModal} from "@/components/ui/OpenAutobindModal";
import {openReleasesModal} from "@/components/editor/releases/ReleasesModal";
import {openProcedureLevelsModal} from "@/components/editor/ProcedureLevelsModal";
import {useEditorStore, type EditorProject} from "../../model/editorStore";

const iconBtn = "shrink-0 p-0.5 rounded transition-colors";
const neutralBtn = cn(iconBtn, "text-neutral-400 hover:text-indigo-500 hover:bg-indigo-100 dark:hover:bg-indigo-900/40");

interface Props {
  project: EditorProject;
  admin: boolean;
}

/** Кнопки строки проекта в списке редактора: уровни, выпуски, эксплуатация, автопривязка, удаление. */
export function ProjectRowActions({project, admin}: Props) {
  const {inOperation, prodVersion, setProjectInOperation, deleteProject} = useEditorStore(useShallow(s => ({
    inOperation: s.projectRuntimeFlags[project.id] === true,
    prodVersion: s.projectProdVersions[project.id],
    setProjectInOperation: s.setProjectInOperation,
    deleteProject: s.deleteProject,
  })));
  const grant = grantOf(project, admin);

  const handleToggleOperation = async () => {
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

  const handleDelete = async () => {
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
      {/* Какой выпуск исполняется (или будет при вводе в эксплуатацию). */}
      {prodVersion != null && (
        <span
          className="shrink-0 rounded-full bg-neutral-500/10 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500 dark:text-neutral-400"
          title="prod-выпуск: его показывает монитор и исполняет runtime"
        >
          prod №{prodVersion}
        </span>
      )}
      <button
        type="button"
        onClick={() => openProcedureLevelsModal(project.id, project.name, grant.edit)}
        className={neutralBtn}
        title="Уровни доступа операций процедур"
        aria-label={`Уровни процедур проекта «${project.name}»`}
      >
        <Gauge size={14} />
      </button>
      {/* Выпуски, эксплуатация и автопривязка — только с правом правки (бэкенд: 403 NO_EDIT). */}
      {grant.edit && <>
        <button
          type="button"
          onClick={() => openReleasesModal(project.id, project.name)}
          className={neutralBtn}
          title="Выпуски проекта: выпустить черновик, сделать prod"
          aria-label={`Выпуски проекта «${project.name}»`}
        >
          <Rocket size={14} />
        </button>
        <button
          type="button"
          aria-pressed={inOperation}
          onClick={() => void handleToggleOperation()}
          className={cn(iconBtn, inOperation
            ? "text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
            : "text-neutral-400 hover:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-900/40")}
          title={inOperation
            ? "В эксплуатации: рантайм исполняет проект. Нажмите, чтобы вывести"
            : "Не в эксплуатации: рантайм проект не исполняет. Нажмите, чтобы ввести"}
          aria-label={inOperation
            ? `Вывести проект «${project.name}» из эксплуатации`
            : `Ввести проект «${project.name}» в эксплуатацию`}
        >
          {inOperation ? <Power size={14} /> : <PowerOff size={14} />}
        </button>
        <button
          type="button"
          onClick={() => openAutobindModal(project.id, project.name)}
          className={neutralBtn}
          title="Автопривязка к базе каналов"
          aria-label={`Автопривязка проекта «${project.name}» к базе каналов`}
        >
          <Link2 size={14} />
        </button>
      </>}
      {/* Удалять проект может только администратор. */}
      {admin && (
        <button
          type="button"
          onClick={() => void handleDelete()}
          className={cn(iconBtn, "text-neutral-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40")}
          title="Удалить проект"
          aria-label={`Удалить проект «${project.name}»`}
        >
          <X size={14} />
        </button>
      )}
    </>
  );
}
