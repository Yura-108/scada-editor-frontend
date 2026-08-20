import {DiagramElement} from "@/types/editorElement.type";

export const getDescendants = (parentKey: string, elements: DiagramElement[]) => {
  // Находим прямых детей текущего родителя
  const directChildren = elements.filter(element => element.parentKey === parentKey);

  // Начинаем формировать массив со всех прямых детей
  let allChildren = [...directChildren];

  // Проходимся по каждому ребенку и рекурсивно ищем его потомков (внуков)
  for (const child of directChildren) {
    allChildren = allChildren.concat(getDescendants(child.key, elements));
  }

  return allChildren;
};