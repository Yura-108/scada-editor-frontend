"use client";

import {useShallow} from "zustand/react/shallow";
import {Save} from "lucide-react";
import {Spinner} from "@/shared/ui/Spinner";
import {useEditorStore} from "../../model/editorStore";
import {TooltipBtn} from "./TooltipBtn";

/**
 * Пока сохранение идёт — спиннер и блокировка: раньше промис не
 * ожидался и не было никакого признака работы, поэтому нетерпеливые
 * клики выстраивали очередь из полных циклов «сохранение + перезагрузка».
 * Точка-индикатор показывает несохранённые изменения; без них кнопка неактивна — новую версию
 * сохранение всё равно не создало бы. Всё, что сохраняется (лист и вид для монитора тоже), лежит
 * в `elements`, поэтому `isDirty` других правок не пропускает.
 */
export function SaveButton({canSave}: {canSave: boolean}) {
  const {isSaving, isDirty, exportScene} = useEditorStore(useShallow(s => ({
    isSaving: s.isSaving, isDirty: s.isDirty, exportScene: s.exportScene,
  })));

  return (
    <TooltipBtn
      icon={isSaving
        ? <Spinner size={16} />
        : <Save size={16} strokeWidth={2.5} />}
      label={isSaving ? "Сохранение…" : isDirty ? "Сохранить (есть изменения)" : "Сохранить — изменений нет"}
      onClick={() => { void exportScene(); }}
      disabled={!canSave || isSaving || !isDirty}
      className="relative flex items-center justify-center w-9 h-9 rounded-xl
        bg-primary/10 border border-primary/30 text-primary
        hover:bg-primary/20 hover:border-primary/40
        active:translate-y-0.5 transition-all
        disabled:opacity-20 disabled:cursor-not-allowed"
      badge={isDirty && !isSaving}
    />
  );
}
