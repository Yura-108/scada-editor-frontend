"use client";

import React, {useEffect} from "react";
import {AlertTriangle, RotateCcw, Save, X} from "lucide-react";
import {Banner} from "@/shared/ui/Banner";
import {Button} from "@/shared/ui/Button";
import {IconButton} from "@/shared/ui/IconButton";
import {Spinner} from "@/shared/ui/Spinner";
import {ProjectSelect} from "@/core/project";
import {BranchTree} from "./BranchTree";
import {useBranchesEditor} from "./useBranchesEditor";
import {useCatalogTree, type PathStatus} from "./useCatalogTree";

function BranchList({branches, statusOf, onRemove}: {
  branches: string[];
  statusOf: (path: string) => PathStatus;
  onRemove: (path: string) => void;
}) {
  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">Веток нет — отметьте узлы в дереве.</p>;
  }
  return (
    <ul className="space-y-1">
      {branches.map(path => {
        const missing = statusOf(path) === "missing";
        return (
          <li key={path} className="flex items-start gap-1 rounded-md border bg-card px-2 py-1">
            <div className="min-w-0 flex-1">
              <div className="break-all font-mono text-xs">{path}</div>
              {missing && (
                <div className="flex items-center gap-1 text-xs text-destructive">
                  <AlertTriangle size={12} aria-hidden />Такого пути нет в базе каналов
                </div>
              )}
            </div>
            <IconButton icon={X} size="xs" label={`Убрать ветку «${path}»`} onClick={() => onRemove(path)} />
          </li>
        );
      })}
    </ul>
  );
}

/** Ветки каталога проекта: какие узлы базы каналов видят и правят его пользователи. */
export function BranchesTab() {
  const editor = useBranchesEditor();
  const tree = useCatalogTree();
  const {ensurePaths} = tree;
  const {branches} = editor;

  // Сохранённые ветки проверяются по базе: подгружаем их площадки и проекты.
  useEffect(() => { void ensurePaths(branches); }, [branches, ensurePaths]);

  const missingCount = branches.filter(b => tree.statusOf(b) === "missing").length;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        Ветки определяют, какие узлы базы каналов видят и правят пользователи проекта: «правка» в проекте —
        правка узлов под ветками, «просмотр» — чтение. Без веток каталог для них пуст. Удалять корень ветки
        и узлы выше может только администратор.
      </p>
      <ProjectSelect projects={editor.projectList} value={editor.projectId}
        onChange={id => void editor.selectProject(id)} className="max-w-72" />
      {editor.projectId != null && (editor.loading ? <Spinner label="Загрузка…" /> : (
        <>
          {editor.usersWithoutCatalog.length > 0 && (
            <Banner tone="warning" icon={AlertTriangle} className="max-w-3xl">
              Без веток пользователи проекта «{editor.projectName}» ({editor.usersWithoutCatalog.join(", ")})
              не видят базу каналов.
            </Banner>
          )}
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
            <BranchTree tree={tree} branches={branches} onCheck={editor.check} className="min-h-64" />
            <div className="flex min-h-0 flex-col gap-3">
              <div className="text-sm font-medium">Ветки проекта: {branches.length}</div>
              <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                <BranchList branches={branches} statusOf={tree.statusOf}
                  onRemove={path => editor.setBranches(branches.filter(b => b !== path))} />
              </div>
              {missingCount > 0 && (
                <p className="text-xs text-destructive">
                  Путей нет в базе: {missingCount}. Такая ветка ничего не открывает — уберите её или выберите узел в дереве.
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <Button disabled={!editor.dirty || editor.saving} onClick={editor.reset}>
                  <RotateCcw size={14} />Отменить
                </Button>
                <Button variant="primary" disabled={editor.saving || !editor.dirty} onClick={() => void editor.save()}>
                  <Save size={14} />{editor.saving ? "Сохранение…" : "Сохранить ветки"}
                </Button>
              </div>
            </div>
          </div>
        </>
      ))}
    </div>
  );
}
