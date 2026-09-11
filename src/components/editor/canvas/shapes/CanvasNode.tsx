"use client";

import React from "react";
import { Group, Rect } from "react-konva";
import Konva from "konva";
import { resetCanvasCursor } from "@/lib/editor/canvasCursor";
import { GroupElement } from "@/types/editorElement.type";
import { getRenderedElementWith } from "@/lib/getRenderedElement";
import { useEditorStore } from "@/store/useEditorStore";
import { EditorRenderContext, MIN_SIZE } from "../types";
import { useElementRenderState, useMembersInteractive, useOrderedMemberKeys } from "../useElementRenderState";
import { ShapeElement } from "./ShapeElement";

interface CanvasNodeProps {
  /** Ключ элемента. Сам элемент узел достаёт из стора — см. useElementRenderState. */
  elementKey: string;
  ctx: EditorRenderContext;
}

/**
 * Узел холста: подписывается на свой элемент и рисует его — фигуру или группу.
 *
 * Узлы адресуются КЛЮЧОМ, а не объектом элемента. Благодаря этому родитель не
 * перерисовывает детей, когда меняется он сам: каждый узел независимо следит за
 * своим срезом стора. Раньше вся сцена ехала одним объектом-контекстом из
 * Canvas, и перетаскивание одной фигуры реконсилировало все N узлов.
 */
function CanvasNodeBase({ elementKey, ctx }: CanvasNodeProps) {
  const state = useElementRenderState(elementKey);
  const el = state.el;

  // Элемент удалён (или ещё не подгружен) — рисовать нечего.
  if (!el) return null;

  // `visible: false` — элемент есть в схеме и сохраняется, но фигурой не является.
  // Так приезжает служебный элемент импорта CONTUR (`contur_meta`) с данными листа:
  // трубопроводы, связи, программы операций. Без этой проверки он попадал бы в
  // запасную ветку ShapeElement и рисовался прямоугольником 0×0 с подписью.
  if (el.visible === false) return null;

  if (el.type === "group") {
    return <GroupNode group={el as GroupElement} ctx={ctx} state={state} />;
  }

  return (
    <ShapeElement
      el={el}
      ctx={ctx}
      // Когда к фигуре прицеплен Transformer, его рамка заменяет собственную
      // пунктирную рамку (двойная рамка выглядит грязно).
      isSelected={state.isSelected && !state.isTransformerTarget}
      isEditing={state.isEditing}
      focusedCell={state.focusedCell}
      // Смена состояния (и рантайм-значения монитора) не меняют сам элемент —
      // без этих пропов React.memo фигуры возвращал бы прошлый рендер, и холст
      // на переключение состояния не реагировал вовсе.
      stateId={state.stateId}
      runtime={state.runtime}
    />
  );
}

/**
 * Мемоизировано: пропы — строка и стабильный ctx, поэтому родительский ре-рендер
 * узел не задевает. Всё изменчивое приходит через собственную подписку.
 */
export const CanvasNode = React.memo(CanvasNodeBase);

interface GroupNodeProps {
  group: GroupElement;
  ctx: EditorRenderContext;
  state: ReturnType<typeof useElementRenderState>;
}

/**
 * Группа/компонент и рекурсивно её состав: composition (примитивы) + children
 * (компоненты). Живёт в одном файле с CanvasNode — рекурсия идёт через него.
 */
function GroupNode({ group, ctx, state }: GroupNodeProps) {
  const { updateElementVisual, onElementClick, resolveClickTarget, enterGroup, themeColors } = ctx;
  const { isSelected, isActiveGroup } = state;
  // Состав в порядке отрисовки: composition + children, отсортированные по zIndex.
  const memberKeys = useOrderedMemberKeys(group);
  // Содержимое доступно только когда в группу вошли (или находятся глубже).
  const membersInteractive = useMembersInteractive(group.key);
  // Состояние группы берём из подписки узла (state), а не из стора нереактивно:
  // у контейнера в overrides лежат x/y/w/h, и при переключении состояния рамка
  // должна ехать вместе с содержимым.
  const rendered = getRenderedElementWith(group, state.stateId, state.runtime);
  const showFrame = isActiveGroup || isSelected;

  return (
    <Group
      id={group.key}
      x={rendered.x}
      y={rendered.y}
      draggable
      onDragStart={(e) => {
        if (e.target === e.currentTarget && !isSelected) {
          e.target.stopDrag();
        }
      }}
      onDragEnd={(e) => {
        if (e.target !== e.currentTarget) return;
        // Позиция уже привязана общим обработчиком Stage (сетка + направляющие).
        updateElementVisual(group.key, {
          x: e.target.x(),
          y: e.target.y(),
        });
      }}
      onDblClick={(e) => {
        e.cancelBubble = true;
        const clickedId = (e.target as Konva.Node).attrs.id
          || (e.target as Konva.Node).parent?.attrs.id
          || (e.target as Konva.Node).parent?.parent?.attrs.id;
        const resolved = clickedId ? resolveClickTarget(clickedId) : group.key;
        if (resolved === group.key) {
          enterGroup(group.key);
        }
      }}
    >
      {/* Фоновая хит-область группы. Рамку выделения она НЕ рисует: фон лежит под
          составом, и рамка по контуру содержимого пряталась бы под крайними фигурами. */}
      <Rect
        x={0}
        y={0}
        width={rendered.w}
        height={rendered.h}
        fill="transparent"
        // Рамка без отступа у группы из одних горизонтальных (вертикальных) линий имеет
        // нулевую высоту (ширину): у заливки не остаётся площади, и группу не выделить
        // кликом. Невидимая хит-обводка даёт такой рамке полосу, за которую можно взяться.
        hitStrokeWidth={rendered.w < MIN_SIZE || rendered.h < MIN_SIZE ? MIN_SIZE / 2 : undefined}
        listening={true}
        onClick={(e) => {
          e.cancelBubble = true;
          onElementClick(group.key, e.evt.shiftKey || e.evt.ctrlKey);
        }}
        onMouseEnter={e => {
          if (isSelected) {
            const container = e.target.getStage()?.container();
            if (container) container.style.cursor = "move";
          }
        }}
        onMouseLeave={e => {
          const container = e.target.getStage()?.container();
          resetCanvasCursor(container);
        }}
      />
      {/* Обёртка ради listening: выключить сам <Group> нельзя — Konva гасит всё
          поддерево, и вместе с составом умерла бы фоновая хит-область группы выше,
          то есть группу нельзя было бы ни выделить, ни открыть двойным кликом.
          Пока группа не открыта, состав вне хит-графа: клик, двойной клик,
          перетаскивание и наведение попадают в саму группу. */}
      <Group listening={membersInteractive}>
        {memberKeys.map(childKey => (
          <CanvasNode key={childKey} elementKey={childKey} ctx={ctx} />
        ))}
      </Group>
      {/* Рамка — ПОСЛЕ состава, то есть поверх него: так её не накрывает ни фигура с
          краю, ни соседняя группа внутри. */}
      {showFrame && (
        <GroupFrame
          w={rendered.w}
          h={rendered.h}
          color={themeColors.selection}
          haloColor={themeColors.handleFill}
        />
      )}
    </Group>
  );
}

/** Зазор между содержимым группы и внутренним краем линии рамки, экранные px. */
const FRAME_GAP_PX = 4;
/** Толщина линии рамки, экранные px. */
const FRAME_WIDTH_PX = 2;
/** Толщина подложки под линией, экранные px. */
const FRAME_HALO_PX = 4;

interface GroupFrameProps {
  w: number;
  h: number;
  color: string;
  haloColor: string;
}

/**
 * Рамка выделенной / открытой группы — сплошная линия чуть снаружи содержимого.
 *
 * Отступ — в ЭКРАННЫХ пикселях, а не клетками: у самой группы отступа нет
 * (`GROUP_PADDING = 0`, её x/y/w/h лежат ровно по контуру членов), сдвигается только
 * нарисованная линия. Экранный отступ в мировых единицах — это `px / zoom`, поэтому
 * зум читается ЛОКАЛЬНОЙ подпиской, как у ручек ресайза: положить его в ctx значило бы
 * перерисовывать всю сцену на каждый тик колеса. Компонент смонтирован, только пока
 * рамка видна, так что подписка есть у одной-двух групп, а не у всех.
 *
 * Под линией — подложка цвета фона: рамку видно поверх фигуры любого цвета, в том
 * числе того же синего. `strokeScaleEnabled={false}` держит толщину в экранных px.
 */
function GroupFrame({ w, h, color, haloColor }: GroupFrameProps) {
  const zoom = useEditorStore(s => s.camera.zoom);
  // Ось линии — на половину её толщины дальше зазора: тогда между содержимым и
  // внутренним краем синей линии ровно FRAME_GAP_PX.
  const inset = (FRAME_GAP_PX + FRAME_WIDTH_PX / 2) / zoom;
  const box = { x: -inset, y: -inset, width: w + inset * 2, height: h + inset * 2 };

  return (
    <>
      <Rect
        {...box}
        stroke={haloColor}
        strokeWidth={FRAME_HALO_PX}
        opacity={0.85}
        strokeScaleEnabled={false}
        listening={false}
      />
      <Rect
        {...box}
        stroke={color}
        strokeWidth={FRAME_WIDTH_PX}
        strokeScaleEnabled={false}
        listening={false}
      />
    </>
  );
}
