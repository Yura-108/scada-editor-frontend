import {parse} from "acorn";
import {translateSyntaxMessage} from "./scriptSyntaxMessages";

/**
 * Синтаксическая проверка скрипта — до сохранения, в редакторе.
 *
 * Бэкенд с 25.09.2026 отклоняет ВСЮ сцену, если хоть в одном скрипте синтаксическая
 * ошибка (docs/contract/2026-09-25-script-syntax-check-contract.md). Проверка здесь не
 * заменяет серверную, а показывает ошибку автору сразу — иначе он узнал бы о ней только
 * при сохранении, одним сообщением на всю сцену.
 *
 * Правила те же, что у бэкенда: текст разбирается как ТЕЛО функции (`return` на верхнем
 * уровне допустим), пустой скрипт допустим. Необъявленные имена (теги, `runScript`) ошибкой
 * синтаксиса не являются, так что параметры скоупа не нужны.
 *
 * Разбирает acorn, а не `new Function`: страница обходится без `'unsafe-eval'` (#20 п. 1,
 * шаг 6) — скрипты схем исполняет только воркер-песочница со своей политикой. Заодно в тексте
 * ошибки есть строка и позиция.
 *
 * Возвращает текст ошибки или `null`.
 */
export const checkScriptSyntax = (code: string | null | undefined): string | null => {
  if (!code || !code.trim()) return null;
  try {
    parse(code, {ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true});
    return null;
  } catch (err) {
    if (!(err instanceof SyntaxError)) return null;
    // acorn дописывает к сообщению «(строка:колонка)» — переносим их вперёд по-русски.
    const loc = (err as SyntaxError & {loc?: {line: number; column: number}}).loc;
    const message = translateSyntaxMessage(err.message.replace(/\s*\(\d+:\d+\)$/, ""));
    return loc ? `строка ${loc.line}, позиция ${loc.column + 1}: ${message}` : message;
  }
};
