import type {SceneTarget} from "@/lib/runtime/eventScript";

/**
 * Какая схема имеется в виду в `openScene(...)` из обработчика события.
 *
 * Чистый модуль: один и тот же разбор нужен монитору (переход) и тест-прогону в
 * редакторе события (показать, куда уйдёт клик), и разъехаться им нельзя.
 *
 * Ищем только в переданном списке — это `sceneList` стора, схемы ТЕКУЩЕГО проекта.
 * Схему другого проекта скрипт открыть не может, даже зная её id.
 */

export interface SceneRef {
  id: number;
  name: string;
}

export type SceneTargetResult =
  | {kind: "found"; scene: SceneRef}
  | {kind: "missing"}
  | {kind: "ambiguous"; count: number};

const normalize = (name: string) => name.trim().toLowerCase();

export const resolveSceneTarget = (
  target: SceneTarget,
  scenes: readonly SceneRef[],
): SceneTargetResult => {
  if (typeof target === "number") {
    const scene = scenes.find(s => s.id === target);
    return scene ? {kind: "found", scene} : {kind: "missing"};
  }

  // Сначала точное имя, и только потом «без регистра и пробелов по краям»: иначе
  // схемы «Насосная» и «насосная» были бы неотличимы даже при точном вызове.
  const exact = scenes.filter(s => s.name === target);
  const matches = exact.length ? exact : scenes.filter(s => normalize(s.name) === normalize(target));

  if (matches.length === 1) return {kind: "found", scene: matches[0]};
  if (matches.length > 1) return {kind: "ambiguous", count: matches.length};
  return {kind: "missing"};
};

/** Цель так, как её показывать человеку: «Насосная» или #42. */
export const describeSceneTarget = (target: SceneTarget) =>
  typeof target === "number" ? `#${target}` : `«${target}»`;
