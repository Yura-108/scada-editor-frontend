import {useEffect, useMemo, useState} from "react";
import {DiagramElement} from "@/core/scene";
import {sortByZIndex, sortKeysByZIndex, getElementIndex} from "@/core/scene";
import {useEditorStore} from "../../model/editorStore";

export interface LayerRowData {
  el: DiagramElement;
  depth: number;
  isComposition: boolean;
}

/**
 * Дерево панели слоёв: корни сцены в порядке отрисовки, плоский список видимых строк,
 * свёрнутые группы, «свернуть/развернуть всё» и раскрытие предков выделенного.
 */
export function useLayerTree() {
  const elements = useEditorStore(s => s.elements);
  const scene = useEditorStore(s => s.scene);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Общий индекс схемы (кэширован по ссылке на массив) — та же карта, что у холста.
  // Нужен и для состава строк, и для подъёма по parentKey к предкам выделенного.
  const byKey = useMemo(() => getElementIndex(elements).byKey, [elements]);

  // Порядок строк обязан совпадать с порядком отрисовки холста — тот же zIndex
  // со стабильной сортировкой (при равных слоях остаётся порядок массива).
  // `visible: false` — служебный элемент (данные листа), фигурой не является:
  // в дереве слоёв это была бы пустая строка. Так же он отфильтрован в маркизе
  // и во «вписать схему».
  const roots = useMemo(
    () => sortByZIndex(elements.filter(
      el => el.parentKey === String(scene?.id) && el.visible !== false,
    )),
    [elements, scene],
  );

  const toggleCollapsed = (key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /**
   * Ключи всех контейнеров схемы — по `elements`, а НЕ по видимым строкам.
   *
   * Группа внутри уже свёрнутой в `visibleRows` отсутствует, и «свернуть всё» оставило
   * бы её раскрытой — она развернулась бы сама, стоит открыть родителя.
   */
  const containerKeys = useMemo(
    () => elements
      .filter(el => el.type === "group" && [...(el.composition ?? []), ...el.children].length > 0)
      .map(el => el.key),
    [elements],
  );

  const allCollapsed = containerKeys.length > 0 && containerKeys.every(k => collapsed.has(k));

  const toggleAll = () => setCollapsed(allCollapsed ? new Set() : new Set(containerKeys));

  /**
   * Плоский список видимых строк в порядке отрисовки.
   *
   * Дерево и раньше рендерилось плоско (вложенность передаётся только отступом
   * через paddingLeft), поэтому развернуть рекурсию в массив — не изменение
   * разметки, а необходимое условие для клавиатуры: по нему считаются
   * «следующая/предыдущая строка» для стрелок и aria-level.
   */
  const visibleRows = useMemo(() => {
    const rows: LayerRowData[] = [];

    const walk = (el: DiagramElement, depth: number, isComposition: boolean) => {
      rows.push({el, depth, isComposition});
      if (el.type !== "group" || collapsed.has(el.key)) return;
      // Порядок отрисовки на холсте: по zIndex среди соседей; при равных слоях —
      // порядок конкатенации composition (низ) → children (верх).
      const memberKeys = sortKeysByZIndex([...(el.composition ?? []), ...el.children], byKey);
      memberKeys.forEach(k => {
        const member = byKey[k];
        if (member) walk(member, depth + 1, (el.composition ?? []).includes(k));
      });
    };

    roots.forEach(el => walk(el, 0, false));
    return rows;
  }, [byKey, collapsed, roots]);

  /**
   * Раскрываем свёрнутых предков выделенного — иначе его строки в дереве просто нет,
   * и прокручивать было бы не к чему.
   *
   * Именно подписка на стор, а не эффект по `selectedIds`: выделение приходит ИЗВНЕ
   * панели (холст, хоткеи, вход в группу), и это ровно тот «внешний источник», ради
   * которого подписки и существуют — `setState` в теле эффекта дал бы каскадный
   * ре-рендер на каждую смену выделения.
   *
   * Раскрытие остаётся в `collapsed` (а не выводится при рендере) намеренно: иначе
   * ветку с выделенным элементом нельзя было бы свернуть стрелкой — вывод тут же
   * раскрывал бы её обратно.
   */
  useEffect(() => useEditorStore.subscribe((state, prev) => {
    const key = state.selectedIds[state.selectedIds.length - 1];
    if (!key || key === prev.selectedIds[prev.selectedIds.length - 1]) return;

    const byKeyNow = getElementIndex(state.elements).byKey;
    const ancestors: string[] = [];
    for (let k = byKeyNow[key]?.parentKey; k && byKeyNow[k]; k = byKeyNow[k].parentKey) {
      ancestors.push(k);
    }
    if (!ancestors.length) return;

    setCollapsed(prevSet => {
      // Прежний Set по ссылке, если раскрывать нечего: новый объект здесь означал бы
      // ре-рендер дерева на каждое изменение стора.
      if (!ancestors.some(k => prevSet.has(k))) return prevSet;
      const next = new Set(prevSet);
      ancestors.forEach(k => next.delete(k));
      return next;
    });
  }), []);

  return {collapsed, toggleCollapsed, containerKeys, allCollapsed, toggleAll, visibleRows};
}
