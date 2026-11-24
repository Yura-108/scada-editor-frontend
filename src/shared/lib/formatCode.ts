/**
 * Простой безопасный авто-форматтер для C-подобного кода (JavaScript и Java).
 *
 * Пересчитывает только ОТСТУПЫ строк по балансу скобок `{}`, `()`, `[]`, не трогая
 * само содержимое строк, поэтому не может «сломать» код: в худшем случае отступ
 * получится неидеальным, но текст (без ведущих/хвостовых пробелов) сохраняется.
 * Скобки внутри строковых литералов и комментариев игнорируются.
 *
 * Зависимостей нет намеренно: prettier не поддерживает Java из коробки, а тянуть
 * его в клиентский бандл ради переотступа кода не нужно.
 */

interface ScanResult {
  /** Сколько закрывающих скобок стоит в начале строки (уменьшают отступ этой строки). */
  leadingClosers: number;
  /** Итоговое изменение глубины вложенности после строки (влияет на следующую). */
  delta: number;
  /** Осталась ли строка внутри незакрытого блочного комментария. */
  endInBlock: boolean;
}

function scanLine(line: string): ScanResult {
  let delta = 0;
  let leadingClosers = 0;
  let contentStarted = false;
  let inString: string | null = null;
  let inBlock = false;
  let i = 0;

  while (i < line.length) {
    const c = line[i];
    const c2 = line[i + 1];

    if (inBlock) {
      if (c === "*" && c2 === "/") {
        inBlock = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }

    if (inString) {
      if (c === "\\") {
        i += 2;
        continue;
      }
      if (c === inString) inString = null;
      i++;
      continue;
    }

    if (c === "/" && c2 === "/") break; // строчный комментарий — остальное игнорируем
    if (c === "/" && c2 === "*") {
      inBlock = true;
      contentStarted = true;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      inString = c;
      contentStarted = true;
      i++;
      continue;
    }
    if (c === "{" || c === "(" || c === "[") {
      delta++;
      contentStarted = true;
      i++;
      continue;
    }
    if (c === "}" || c === ")" || c === "]") {
      delta--;
      if (!contentStarted) leadingClosers++;
      i++;
      continue;
    }
    if (c !== " " && c !== "\t") contentStarted = true;
    i++;
  }

  return {leadingClosers, delta, endInBlock: inBlock};
}

/** Идёт ли строка (уже внутри блочного комментария) до его закрытия `*​/`. */
function stillInBlockComment(line: string): boolean {
  const end = line.indexOf("*/");
  return end === -1;
}

export function formatCode(source: string, tabWidth = 2): string {
  const unit = " ".repeat(tabWidth);
  const rawLines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: string[] = [];
  let depth = 0;
  let inBlock = false;
  let blankRun = 0;

  for (const raw of rawLines) {
    const line = raw.trim();

    if (line === "") {
      // Схлопываем 2+ подряд пустые строки в одну.
      blankRun++;
      if (blankRun <= 1) out.push("");
      continue;
    }
    blankRun = 0;

    if (inBlock) {
      // Продолжение блочного комментария — выравниваем «звёздочку».
      const prefix = unit.repeat(depth);
      out.push(prefix + (line.startsWith("*") ? " " + line : line));
      inBlock = stillInBlockComment(line);
      continue;
    }

    const {leadingClosers, delta, endInBlock} = scanLine(line);
    const thisDepth = Math.max(0, depth - leadingClosers);
    out.push(unit.repeat(thisDepth) + line);
    depth = Math.max(0, depth + delta);
    inBlock = endInBlock;
  }

  // Убираем хвостовые пустые строки.
  while (out.length && out[out.length - 1] === "") out.pop();

  return out.join("\n");
}
