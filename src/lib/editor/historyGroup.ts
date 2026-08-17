import { DiagramElement } from "@/types/editorElement.type";
import { useEditorStore } from "@/store/useEditorStore";

/**
 * Склейка серии правок в ОДИН шаг истории undo.
 *
 * История (zundo) фиксирует снимок на каждое изменение массива `elements`.
 * Для непрерывных жестов это неверно: перетаскивание группы, ведение по палитре
 * цвета или удержание стрелки — это одно действие пользователя, а в стеке из
 * 50 записей оно занимало десятки позиций, и Ctrl+Z возвращал по пикселю.
 *
 * Приём: на время жеста запись останавливается, а по его завершении в стек
 * кладётся один снимок состояния «до».
 *
 * Вложенные вызовы допустимы — считается глубина, снимок берётся на самом
 * внешнем `begin`. Каждый `begin` ОБЯЗАН быть закрыт `end` (в т.ч. при
 * размонтировании компонента), иначе история останется на паузе.
 */
let depth = 0;
let snapshot: DiagramElement[] | null = null;

export function beginHistoryGroup(): void {
  if (depth++ > 0) return;
  snapshot = useEditorStore.getState().elements;
  useEditorStore.temporal.getState().pause();
}

export function endHistoryGroup(): void {
  if (depth === 0) return;
  if (--depth > 0) return;

  const before = snapshot;
  snapshot = null;

  const temporal = useEditorStore.temporal.getState();
  temporal.resume();

  // Ничего не изменилось — записи в истории быть не должно.
  if (!before || useEditorStore.getState().elements === before) return;

  useEditorStore.temporal.setState({
    pastStates: [...temporal.pastStates, { elements: before }],
    futureStates: [],
  });
}
