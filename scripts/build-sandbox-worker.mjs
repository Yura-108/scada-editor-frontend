// Воркер-песочница скриптов схем (#20 п. 1) — отдельным файлом `public/sandbox/worker.js`.
//
// Не через `new Worker(new URL(…, import.meta.url))`: Turbopack создаёт такой воркер из
// blob-URL, а blob-воркер наследует политику безопасности страницы. Своя политика у воркера
// (`next.config.ts`: без сети, без `import()`) возможна только у файла, загруженного по своему
// адресу, — её браузер берёт из заголовка ответа.
//
// Запускается перед `next dev` и `next build` (`predev` / `prebuild`). Правка файлов воркера при
// запущенном `npm run dev` — перезапустить его или `node scripts/build-sandbox-worker.mjs`.
import {build} from "esbuild";

const production = process.argv.includes("--production");

await build({
  entryPoints: ["src/core/runtime/sandbox/sandbox.worker.ts"],
  outfile: "public/sandbox/worker.js",
  bundle: true,
  // Классический воркер: модулю `import()` нужен для себя, а политика воркера его запрещает.
  format: "iife",
  target: "es2020",
  platform: "browser",
  minify: production,
  sourcemap: production ? false : "inline",
  legalComments: "none",
  logLevel: "warning",
});

console.log(`[sandbox] воркер собран: public/sandbox/worker.js${production ? " (production)" : ""}`);
