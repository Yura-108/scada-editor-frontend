import React from "react";
import {ClipboardList, Cpu, SearchCode} from "lucide-react";
import {useCurrentProjectGrant, canWriteDirectly} from "@/core/access";
import {Badge} from "@/shared/ui/Badge";
import {Button} from "@/shared/ui/Button";
import {useAutomationTasksStore} from "../model/useAutomationTasksStore";
import {countTaskProblems} from "./AutomationTaskPanel";
import {openObjectInspectorModal} from "./ObjectInspectorModal";

interface Props {
  /** Живая сессия: кнопки только при ней — в архиве записи невозможны, а значения из прошлого. */
  live: boolean;
  showProcedures: boolean;
  onShowProcedures: () => void;
  showTasks: boolean;
  onToggleTasks: () => void;
}

/** Кнопки шапки монитора: «Процедуры», «Инспектор», «Задачи». */
export function MonitorActions({live, showProcedures, onShowProcedures, showTasks, onToggleTasks}: Props) {
  // «Опции» и инспектор пишут теги/свойства напрямую: «управление» и уровень ≥ 9.
  const directWrite = canWriteDirectly(useCurrentProjectGrant());
  const taskProblems = useAutomationTasksStore(s => countTaskProblems(s.byId));

  if (!live) return null;

  return (
    <>
      {!showProcedures && (
        <Button size="sm" onClick={onShowProcedures} title="Процедуры">
          <ClipboardList size={14} />
          <span className="hidden xl:inline">Процедуры</span>
        </Button>
      )}

      {/* Инспектор объектов: любой объект выпуска со всех схем, все его свойства с правкой.
          Только при живой сессии — в архиве записи невозможны, а значения из прошлого. */}
      {directWrite && (
        <Button size="sm" onClick={() => openObjectInspectorModal()} title="Инспектор объектов: свойства любого объекта проекта">
          <SearchCode size={14} />
          <span className="hidden xl:inline">Инспектор</span>
        </Button>
      )}

      <Button
        size="sm"
        onClick={onToggleTasks}
        aria-pressed={showTasks}
        className="aria-pressed:bg-accent"
        title={taskProblems > 0 ? `Задач с проблемами: ${taskProblems}` : "Фоновые задачи проекта"}
      >
        <Cpu size={14} />
        <span className="hidden xl:inline">Задачи</span>
        {taskProblems > 0 && <Badge tone="destructive">{taskProblems}</Badge>}
      </Button>
    </>
  );
}
