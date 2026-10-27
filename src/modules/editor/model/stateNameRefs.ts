import { DiagramElement } from "@/types/editorElement.type";

/**
 * Ссылки на имя состояния из пользовательского кода.
 *
 * Имя состояния — не только подпись в панели: скрипты биндингов и обработчики событий
 * содержат его **строковым литералом** (`setState("Авария")`). Рантайм ищет состояние по
 * имени (`applyRuntimeBatch` в сторе) и при несовпадении **молча пропускает интент** —
 * то есть переименование ломает такие скрипты невидимо. Поэтому переименование сначала
 * ищет эти места, показывает их пользователю и по его решению переписывает.
 *
 * Сканируем ровно два поля, оба несут исполняемый на клиенте JS:
 *   - `element.bindings[].code`         (TagBinding.code)
 *   - `element.events[].handler.code`   (ElementEventHandler.code)
 *
 * `element.scripts[].content` НЕ сканируем: это мост к серверному Java-скрипту
 * (`runScript` в useRuntimeEngine), `setState` там недоступен.
 */

/** Где в пользовательском коде встретилось имя состояния. */
export interface StateNameRef {
  elementKey: string;
  /** Подпись элемента для списка в диалоге. */
  elementLabel: string;
  /** «биндинг «Авария по уровню»» / «событие onClick». */
  where: string;
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Литерал `setState("имя")`. Кавычки любые (обратная ссылка `\2` требует ту же на закрытии),
 * пробелы внутри скобок допускаются. Шаблонные строки намеренно не ловим: внутри них может
 * быть интерполяция, и точную замену там не сделать.
 */
const setStateLiteralRe = (name: string): RegExp =>
  new RegExp(`(setState\\s*\\(\\s*)(["'])${escapeRe(name)}\\2(\\s*\\))`, "g");

/** Есть ли в коде вызов setState с этим именем. */
const codeMentions = (code: string | undefined, name: string): boolean =>
  !!code && setStateLiteralRe(name).test(code);

/**
 * Заменяет имя состояния во всех вызовах `setState`.
 *
 * Новое имя подставляется через `JSON.stringify` — кавычки и слэши внутри имени
 * экранируются сами, поэтому имя состояния ничем ограничивать не нужно.
 */
export function renameStateNameInCode(code: string, oldName: string, newName: string): string {
  return code.replace(
    setStateLiteralRe(oldName),
    (_match, open: string, _quote: string, close: string) =>
      `${open}${JSON.stringify(newName)}${close}`,
  );
}

/**
 * Места в коде поддерева, где упомянуто имя состояния.
 *
 * `subtreeKeys` — ТОЛЬКО поддерево переименования, не вся сцена: `setState` в биндинге
 * применяется к собственному элементу биндинга, поэтому элемент за пределами поддерева
 * со своим одноимённым состоянием — это чужое состояние, и трогать его код нельзя.
 */
export function findStateNameRefs(
  elements: DiagramElement[],
  subtreeKeys: Set<string>,
  name: string,
): StateNameRef[] {
  const refs: StateNameRef[] = [];

  for (const el of elements) {
    if (!subtreeKeys.has(el.key)) continue;
    const elementLabel = el.label || el.type;

    for (const binding of el.bindings ?? []) {
      if (codeMentions(binding.code, name)) {
        refs.push({
          elementKey: el.key,
          elementLabel,
          where: binding.name ? `биндинг «${binding.name}»` : "биндинг",
        });
      }
    }

    for (const event of el.events ?? []) {
      if (codeMentions(event.handler?.code, name)) {
        refs.push({elementKey: el.key, elementLabel, where: `событие ${event.event_type}`});
      }
    }
  }

  return refs;
}
