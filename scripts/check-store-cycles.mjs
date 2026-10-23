// Ищет файлы, которые код стора (слайсы, хелперы модели) подтягивает транзитивно и которые
// сами импортируют стор (через @/modules/editor или editorStore). Каждый такой файл замыкает
// цикл: если первым загрузится слайс, стор выполнит create() раньше, чем слайс определится.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const exts = [".ts", ".tsx", "/index.ts", "/index.tsx"];
const resolve = (from, spec) => {
  let base;
  if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = path.resolve(path.dirname(from), spec);
  else return null;
  if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
  for (const e of exts) if (fs.existsSync(base + e)) return base + e;
  return null;
};
const importsOf = (file) => {
  const s = fs.readFileSync(file, "utf8");
  const out = [];
  // import ... from "x"  /  export ... from "x"   (type-only — без рантайм-зависимости, пропускаем)
  for (const m of s.matchAll(/^(import|export)\s+(type\s+)?[^;]*?from\s+["']([^"']+)["']/gms)) {
    if (m[2]) continue;
    out.push(m[3]);
  }
  for (const m of s.matchAll(/^import\s+["']([^"']+)["']/gm)) out.push(m[1]);
  return out;
};

const MODEL = path.join(SRC, "modules/editor/model");
const INDEX = path.join(SRC, "modules/editor/index.ts");
const STORE = path.join(MODEL, "editorStore.ts");
const starts = fs.readdirSync(path.join(MODEL, "slices")).map(f => path.join(MODEL, "slices", f));

const parent = new Map();
const queue = [...starts];
starts.forEach(s => parent.set(s, null));
const hits = [];
while (queue.length) {
  const f = queue.shift();
  for (const spec of importsOf(f)) {
    const r = resolve(f, spec);
    if (!r) continue;
    if (r === INDEX || r === STORE) {
      if (!starts.includes(f)) hits.push(f);
      continue;
    }
    if (parent.has(r)) continue;
    parent.set(r, f);
    queue.push(r);
  }
}
const chain = (f) => { const c = []; for (let x = f; x; x = parent.get(x)) c.unshift(path.relative(SRC, x)); return c.join(" -> "); };
console.log(`файлов в замыкании слайсов: ${parent.size}; замыкают цикл на стор: ${hits.length}`);
for (const h of [...new Set(hits)]) console.log(" ", chain(h), "-> STORE");
// Цикл найден — ошибка: в браузере это `Cannot access 'createXxxSlice' before initialization`.
// Чинится тем, что файл из цепочки берёт стор через editorStore() (editorStoreRef), а не импортом.
if (hits.length) process.exit(1);
