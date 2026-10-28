// Счётчик «сырых» цветов интерфейса: палитровые классы Tailwind (gray-500, indigo-600, …),
// white/black и произвольные [#hex] в className. Интерфейс красится токенами темы
// (docs/architecture.md, «UI-kit: цвета»), так что число должно только падать.
//
//   npm run check:ui-colors            — итог и разбивка по областям; ошибка, если больше базы
//   npm run check:ui-colors -- --list  — ещё и по файлам
//
// База — scripts/ui-colors-baseline.txt. Перевели файлы на токены — уменьшите её до нового
// числа (скрипт подскажет); увеличивать нельзя.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const BASELINE = path.join(ROOT, "scripts", "ui-colors-baseline.txt");

// Цвета самих схем — данные документа (сохраняются на сервер, одинаковы в обеих темах),
// а палитра холста задаётся строками для Konva. Это не интерфейс.
const EXEMPT = [
  "src/constants/propertiesPanel.ts",
  "src/constants/palette.ts",
  "src/modules/editor/model/newElement.ts",
  "src/core/canvas/",
];

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const UTIL = "bg|text|border|border-[trblxy]|ring|ring-offset|from|via|to|shadow|fill|stroke|outline|divide|placeholder|accent|caret|decoration";
const RE = new RegExp(
  `(?<![\\w-])(?:${UTIL})-(?:(?:${PALETTE})-\\d{2,3}|white|black|\\[#[0-9a-fA-F]{3,8}\\])(?![\\w-])`,
  "g",
);

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, {withFileTypes: true})) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(SRC);

const area = (rel) => {
  const parts = rel.split("/");
  if (parts[1] === "app") return parts.slice(0, 4).join("/").replace(/\/[^/]+\.tsx?$/, "");
  return parts.slice(0, 3).join("/").replace(/\/[^/]+\.tsx?$/, "");
};

let total = 0;
const byFile = [];
const byArea = new Map();
for (const f of files) {
  const rel = path.relative(ROOT, f).split(path.sep).join("/");
  if (EXEMPT.some((e) => rel === e || (e.endsWith("/") && rel.startsWith(e)))) continue;
  const n = (fs.readFileSync(f, "utf8").match(RE) ?? []).length;
  if (!n) continue;
  total += n;
  byFile.push([rel, n]);
  byArea.set(area(rel), (byArea.get(area(rel)) ?? 0) + n);
}

console.log(`сырых цветов интерфейса: ${total} в ${byFile.length} файлах`);
for (const [a, n] of [...byArea].sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${a}`);
if (process.argv.includes("--list")) {
  console.log("");
  for (const [f, n] of byFile.sort((x, y) => y[1] - x[1])) console.log(`  ${String(n).padStart(5)}  ${f}`);
}

if (!fs.existsSync(BASELINE)) {
  console.error(`\nНет базы: запишите ${total} в scripts/ui-colors-baseline.txt.`);
  process.exit(1);
}
const baseline = Number(fs.readFileSync(BASELINE, "utf8").trim());
if (total > baseline) {
  console.error(`\nБольше базы (${baseline}): новые цвета пишите токенами — bg-card, text-muted-foreground, border-input, text-warning…`);
  process.exit(1);
}
if (total < baseline) console.log(`\nМеньше базы (${baseline}) — уменьшите scripts/ui-colors-baseline.txt до ${total}.`);
