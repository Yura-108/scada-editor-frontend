// Замена однозначных пар «светлая / тёмная тема» на токены темы (docs/architecture.md,
// «UI-kit: цвета», таблица «Серые пары → токен»).
//
//   node scripts/ui-colors-codemod.mjs <путь…>           — показать, что заменится (ничего не пишет)
//   node scripts/ui-colors-codemod.mjs <путь…> --write   — заменить
//
// Меняет только пару целиком: `text-gray-500 dark:text-gray-400` → `text-muted-foreground`, с тем же
// префиксом состояния у обеих половин (`hover:bg-gray-100 dark:hover:bg-gray-800` → `hover:bg-accent`).
// Одиночный серый, цветные оттенки и всё, чего нет в правилах ниже, остаются — их правят руками.
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const write = args.includes("--write");
const roots = args.filter((a) => a !== "--write");
if (!roots.length) {
  console.error("Укажите файлы или папки: node scripts/ui-colors-codemod.mjs src/modules/shell [--write]");
  process.exit(1);
}

const GRAY = "gray|neutral|slate|zinc|stone";
// Префикс состояния (`hover:`, `group-hover:`, `focus:`…) — одинаковый у обеих половин пары.
const PAIR = new RegExp(
  `(?<![\\w:-])((?:[a-z-]+:)*)(text|bg|border|divide|placeholder)-(?:(${GRAY})-(\\d{2,3})|(white))(\\/\\d+)?`
  + ` dark:\\1\\2-(${GRAY})-(\\d{2,3})(\\/\\d+)?(?![\\w-])`,
  "g",
);

/** Токен для пары или null — неоднозначно, остаётся на ручную правку. */
function tokenFor(util, prefix, light, isWhite, dark, lightOp, darkOp) {
  const between = (v, lo, hi) => v >= lo && v <= hi;
  switch (util) {
    case "text":
      if (isWhite) return null;
      if (light >= 700 && dark <= 300) return "text-foreground";
      if (between(light, 400, 600) && between(dark, 300, 600)) return "text-muted-foreground";
      return null;
    case "placeholder":
      if (!isWhite && between(light, 400, 500) && between(dark, 400, 600)) return "placeholder:text-muted-foreground";
      return null;
    case "border":
      // Прозрачность тёмной рамки не нужна: у токена `border` в тёмной теме она уже своя.
      if (isWhite) return null;
      if (between(light, 100, 200) && dark >= 700) return "border-border";
      if (light === 300 && between(dark, 600, 700)) return "border-input";
      return null;
    case "divide":
      if (!isWhite && between(light, 100, 200) && dark >= 700) return "divide-border";
      return null;
    case "bg": {
      // Наведение: светлый 50–100 и тёмный 800 с любой прозрачностью — это и есть `accent`.
      if (prefix.includes("hover:") && !isWhite && !lightOp && between(light, 50, 100) && dark === 800) return "bg-accent";
      // Прозрачность у фона — часто намеренная (панель поверх холста): переносим, только если
      // она одинаковая у обеих половин.
      if ((lightOp ?? "") !== (darkOp ?? "")) return null;
      const op = lightOp ?? "";
      if (isWhite && dark >= 800) return `bg-card${op}`;
      if (isWhite) return null;
      if (between(light, 50, 100) && dark >= 800) return prefix.includes("hover:") ? `bg-accent${op}` : `bg-muted${op}`;
      if (light === 200 && dark === 800) return `bg-muted${op}`;
      return null;
    }
    default:
      return null;
  }
}

const files = [];
const walk = (p) => {
  const st = fs.statSync(p);
  if (st.isDirectory()) for (const e of fs.readdirSync(p)) walk(path.join(p, e));
  else if (/\.(ts|tsx)$/.test(p)) files.push(p);
};
roots.forEach(walk);

let total = 0;
const left = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  let n = 0;
  const next = text.replace(PAIR, (whole, prefix, util, _h1, s1, white, lightOp, _h2, s2, darkOp) => {
    const token = tokenFor(util, prefix, Number(s1), Boolean(white), Number(s2), lightOp, darkOp);
    if (!token) {
      left.set(whole, (left.get(whole) ?? 0) + 1);
      return whole;
    }
    n++;
    return prefix + token;
  });
  if (!n) continue;
  total += n;
  console.log(`${String(n).padStart(4)}  ${path.relative(process.cwd(), f).split(path.sep).join("/")}`);
  if (write) fs.writeFileSync(f, next);
}

console.log(`\n${write ? "Заменено" : "Заменится"} пар: ${total}${write ? "" : " (запустите с --write)"}`);
if (left.size) {
  console.log("\nПары без правила — править руками:");
  for (const [pair, n] of [...left].sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${pair}`);
}
