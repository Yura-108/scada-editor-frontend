// Next в режиме output: 'standalone' не кладёт статику рядом с server.js: без
// .next/static и public сервер отдаёт 404 на CSS/JS, и страница открывается без стилей.
// Копируем их после сборки — так же, как это делает Dockerfile.
import {cpSync, existsSync} from "node:fs";

const standalone = ".next/standalone";
if (!existsSync(standalone)) {
  console.error(`[postbuild] нет ${standalone} — сборка не в режиме standalone?`);
  process.exit(1);
}

cpSync(".next/static", `${standalone}/.next/static`, {recursive: true});
if (existsSync("public")) cpSync("public", `${standalone}/public`, {recursive: true});
console.log(`[postbuild] статика скопирована в ${standalone}`);
