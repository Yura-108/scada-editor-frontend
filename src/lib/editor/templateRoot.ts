import {DiagramElement} from "@/types/editorElement.type";

/**
 * Корень шаблона палитры.
 *
 * Шаблоном может быть и группа (техобъект целиком), и **одиночный элемент** —
 * круг, текст, кнопка, — поэтому искать корень по `type === "group"` нельзя:
 * у одиночного шаблона группы нет вовсе, и поиск возвращал бы `undefined`,
 * а сборка дерева — `null` («Не удалось собрать корневой компонент шаблона»).
 *
 * Порядок проверок покрывает оба контекста вызова:
 *  - шаблон, прочитанный из палитры: у корня `parentKey === null`
 *    (`normalizeTemplateForPalette` обнуляет его перед отправкой);
 *  - живое поддерево сцены при сохранении: `parentKey` у корня указывает на сцену
 *    или на группу-владельца, зато корень стоит первым — его кладёт туда
 *    `[el, ...getDescendants(el.key)]`. Группа проверяется перед этим на случай
 *    массива, собранного в другом порядке.
 */
export const findTemplateRoot = (template: DiagramElement[]): DiagramElement | undefined =>
  template.find(el => el.parentKey == null)
  ?? template.find(el => el.type === "group")
  ?? template[0];
