"use client";

import React, {useEffect, useMemo} from "react";
import {Plus} from "lucide-react";
import {Badge} from "@/shared/ui/Badge";
import {IconButton} from "@/shared/ui/IconButton";
import {promptModal} from "@/shared/ui/dialog/confirmModal";
import {PickerSelect} from "@/shared/ui/field/PickerSelect";
import {canOpenInEditor, grantOf, useSessionUserStore} from "@/core/access";
import {useEditorStore} from "../../model/editorStore";
import {selectProjectGuarded} from "../../model/openScene";
import {ProjectRowActions} from "./ProjectRowActions";

/**
 * Выбор проекта в шапке редактора. Заменил окно «Выберите проект»: строки несут его кнопки
 * (`ProjectRowActions`), создание — отдельной кнопкой «+» рядом (только администратор).
 * После выбора раскрывается выбор схемы (`onPicked`) — как раньше за окном проекта шло
 * окно схем.
 */
export function ProjectPicker({open, onOpenChange, onPicked}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPicked: () => void;
}) {
  const allProjects = useEditorStore(s => s.projectList);
  const currentProject = useEditorStore(s => s.currentProject);
  const runtimeFlags = useEditorStore(s => s.projectRuntimeFlags);
  const prodVersions = useEditorStore(s => s.projectProdVersions);
  const loadProjectRuntimeFlag = useEditorStore(s => s.loadProjectRuntimeFlag);
  const createProject = useEditorStore(s => s.createProject);
  const admin = useSessionUserStore(s => s.admin);

  // С одним «управлением» проект в редакторе не открывается (бэкенд ответит 403) — его нет
  // в списке. Список стора остаётся полным: он же кормит монитор.
  const projects = useMemo(
    () => allProjects.filter(p => canOpenInEditor(grantOf(p, admin))),
    [allProjects, admin],
  );

  // Флаг эксплуатации бэкенд отдаёт отдельным запросом на каждый проект — спрашиваем,
  // когда список раскрыт, а не при каждом открытии редактора.
  useEffect(() => {
    if (open) for (const p of projects) void loadProjectRuntimeFlag(p.id);
  }, [open, projects, loadProjectRuntimeFlag]);

  const pick = async (value: string) => {
    const project = projects.find(p => String(p.id) === value);
    if (project && await selectProjectGuarded(project)) onPicked();
  };

  const create = async () => {
    const name = (await promptModal({
      title: "Новый проект",
      label: "Название проекта",
      placeholder: "Например: Цех розлива",
      confirmLabel: "Создать",
    }))?.trim();
    if (!name) return;
    const created = await createProject(name);
    // У нового проекта схем нет: список не запрашиваем, выбор схемы откроется пустым.
    if (created && await selectProjectGuarded(created, {skipSceneFetch: true})) onPicked();
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <PickerSelect
        aria-label="Проект"
        placeholder="Проект…"
        className="w-56"
        contentClassName="min-w-96"
        value={currentProject ? String(currentProject.id) : null}
        valueLabel={currentProject?.name}
        open={open}
        onOpenChange={onOpenChange}
        onValueChange={v => void pick(v)}
        emptyText={admin
          ? "Проектов пока нет — создайте первый кнопкой «+»"
          : "Нет проектов, доступных для просмотра или правки. Права выдаёт администратор."}
        items={projects.map(p => ({
          value: String(p.id),
          label: p.name,
          // Какой выпуск исполняется (или будет при вводе в эксплуатацию).
          meta: prodVersions[p.id] != null && (
            <Badge className="ml-auto shrink-0" title="prod-выпуск: его показывает монитор и исполняет runtime">
              prod №{prodVersions[p.id]}
            </Badge>
          ),
          actions: (
            <ProjectRowActions
              project={p}
              canEdit={grantOf(p, admin).edit}
              admin={admin}
              inOperation={runtimeFlags[p.id] === true}
              onClose={() => onOpenChange(false)}
            />
          ),
        }))}
      />
      {/* Создавать проект может только администратор (иначе 403 NOT_ADMIN). */}
      {admin && <IconButton icon={Plus} label="Новый проект" variant="secondary" onClick={() => void create()} />}
    </div>
  );
}
