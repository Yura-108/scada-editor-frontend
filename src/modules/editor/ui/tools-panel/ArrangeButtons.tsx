"use client";

import {useShallow} from "zustand/react/shallow";
import {
  Group, Ungroup, RotateCw, RotateCcw, FlipHorizontal, FlipVertical,
  // Иконки закомментированного блока выравнивания ниже.
  AlignStartVertical, AlignCenterVertical, AlignEndVertical,
  AlignStartHorizontal, AlignCenterHorizontal, AlignEndHorizontal,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
} from "lucide-react";
import {useEditorStore} from "../../model/editorStore";
import {ToolbarDivider, TooltipBtn} from "./TooltipBtn";

/** Группировка, поворот и отражения выделенного. */
export function ArrangeButtons({canEdit}: {canEdit: boolean}) {
  const {selectedCount, hasGroupSelected} = useEditorStore(useShallow(s => ({
    selectedCount: s.selectedIds.length,
    hasGroupSelected: s.selectedIds.some(id => s.elements.find(e => e.key === id)?.type === "group"),
  })));

  return (
    <>
      <TooltipBtn
        icon={<Group size={16} />}
        label="Сгруппировать"
        onClick={() => useEditorStore.getState().groupSelected()}
        disabled={!canEdit || selectedCount < 2}
      />
      <TooltipBtn
        icon={<Ungroup size={16} />}
        label="Разгруппировать"
        onClick={() => useEditorStore.getState().ungroupSelected()}
        disabled={!canEdit || !hasGroupSelected}
      />

      {/* Поворот на 90° и отражения. Работают и для одного элемента, и для набора,
          и для группы целиком: геометрия пересчитывается по-настоящему (см.
          lib/editor/transformSelection.ts), поэтому всё остаётся на сетке. */}
      <TooltipBtn
        icon={<RotateCw size={16} />}
        label="Повернуть по часовой (Shift + >)"
        onClick={() => useEditorStore.getState().transformSelected("cw")}
        disabled={!canEdit || !selectedCount}
      />
      <TooltipBtn
        icon={<RotateCcw size={16} />}
        label="Повернуть против часовой (Shift + <)"
        onClick={() => useEditorStore.getState().transformSelected("ccw")}
        disabled={!canEdit || !selectedCount}
      />
      <TooltipBtn
        icon={<FlipHorizontal size={16} />}
        label="Отразить по горизонтали (Shift + H)"
        onClick={() => useEditorStore.getState().transformSelected("flipH")}
        disabled={!canEdit || !selectedCount}
      />
      <TooltipBtn
        icon={<FlipVertical size={16} />}
        label="Отразить по вертикали (Shift + V)"
        onClick={() => useEditorStore.getState().transformSelected("flipV")}
        disabled={!canEdit || !selectedCount}
      />

      <ToolbarDivider />

      {/* Выравнивание (≥2 выделенных) и распределение (≥3).
          Блок был закомментирован, из-за чего alignSelected/distributeSelected
          в сторе оставались недостижимым кодом. */}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignStartVertical size={16} />} label="По левому краю"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('left')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignCenterVertical size={16} />} label="По центру (гориз.)"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('hcenter')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignEndVertical size={16} />} label="По правому краю"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('right')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignStartHorizontal size={16} />} label="По верхнему краю"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('top')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignCenterHorizontal size={16} />} label="По центру (верт.)"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('vcenter')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignEndHorizontal size={16} />} label="По нижнему краю"*/}
      {/*  onClick={() => useEditorStore.getState().alignSelected('bottom')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 2}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignHorizontalSpaceBetween size={16} />} label="Распределить по горизонтали"*/}
      {/*  onClick={() => useEditorStore.getState().distributeSelected('h')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 3}*/}
      {/*/>*/}
      {/*<TooltipBtn*/}
      {/*  icon={<AlignVerticalSpaceBetween size={16} />} label="Распределить по вертикали"*/}
      {/*  onClick={() => useEditorStore.getState().distributeSelected('v')}*/}
      {/*  disabled={!canEdit || selectedIds.length < 3}*/}
      {/*/>*/}

      {/*<div className="w-px h-6 bg-gray-300 dark:bg-white/10 self-center mx-0.5" />*/}
    </>
  );
}
