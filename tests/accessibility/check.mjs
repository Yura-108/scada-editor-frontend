import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { checkContrast } from './contrast.mjs';
import { mockWorkspace } from './fixtures.mjs';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');
const host = '127.0.0.1';

async function freePort() {
  const server = createServer().listen(0, host);
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitForServer(origin, server) {
  for (let attempt = 0; attempt < 60 && server.exitCode === null; attempt++) {
    const response = await fetch(`${origin}/login`).catch(() => null);
    if (response?.ok) return;
    await delay(250);
  }
  throw new Error('Standalone-сервер не запустился. Сначала выполните npm run build.');
}

const ready = {
  '/log': (page) => page.getByRole('button', { name: 'Показать изменения операции' }).click(),
  '/automation': (page) => page.getByRole('tab', { name: 'Задачи', exact: true }).waitFor(),
  '/data': (page) => page.getByRole('tab', { name: 'Таблицы', exact: true }).waitFor(),
  '/actions': (page) => page.getByText('За выбранный период действий нет').waitFor(),
  '/admin': (page) => page.getByRole('tab', { name: 'Пользователи', exact: true }).waitFor(),
  '/channels': (page) => page.getByRole('button', { name: /площадк/i }).first().waitFor(),
  '/editor': (page) => page.getByRole('tab', { name: 'Тестовая схема', exact: true }).waitFor(),
  '/monitor': (page) => page.getByRole('radiogroup', { name: 'Режим монитора' }).waitFor(),
};

async function inspect(page, label) {
  if (!(await page.evaluate(() => Boolean(window.axe)))) await page.addScriptTag({ path: axePath });
  const { violations } = await page.evaluate(async () => {
    // Проверяем открытые меню и панели после перехода, иначе axe измеряет промежуточную прозрачность.
    await new Promise(requestAnimationFrame);
    const transitions = document.getAnimations().filter(
      (animation) => animation.playState === 'running'
        && Number.isFinite(animation.effect?.getComputedTiming().endTime),
    );
    await Promise.all(transitions.map((animation) => animation.finished.catch(() => {})));
    return window.axe.run();
  });
  for (const { id, impact, nodes } of violations) {
    console.error(`[${label}] ${id} (${impact}): ${nodes.length}`);
    for (const node of nodes.slice(0, 5)) {
      console.error(`  ${node.target.join(' ')} ${node.html}\n  ${node.failureSummary}`);
    }
  }
  const namedRules = ['region', 'landmark-unique', 'heading-order', 'empty-table-header'];
  return violations.filter(
    ({ id, impact }) => impact === 'critical' || impact === 'serious' || namedRules.includes(id),
  ).map(({ id }) => `${label}: ${id}`);
}

async function checkChannelLists(page, label) {
  const siteTrigger = page.getByRole('button', { name: /^Площадка(?:$|:)/ });
  await siteTrigger.press('Enter');
  const search = page.getByRole('textbox', { name: 'Фильтр: Площадка' });
  await search.fill('Площадка 2');
  await search.press('ArrowDown');
  const sites = page.getByRole('listbox', { name: 'Площадка', exact: true });
  await page.waitForFunction(() => document.activeElement?.getAttribute('role') === 'listbox');
  await page.keyboard.press('Space');
  await sites.getByRole('option', { name: 'Площадка 2', selected: true }).waitFor();
  const failures = await inspect(page, `${label} /channels (площадки)`);
  await page.keyboard.press('Escape');
  await sites.waitFor({ state: 'hidden' });
  await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Площадка:'));

  const projectTrigger = page.getByRole('button', { name: /^Проекты базы каналов:/ });
  await projectTrigger.click();
  const projects = page.getByRole('listbox', { name: 'Проекты базы каналов', exact: true });
  await projects.press('Home');
  await projects.press('Space');
  await projects.press('ArrowDown');
  await projects.press('Enter');
  await projects.getByRole('option', { name: 'Проект 1', selected: true }).waitFor();
  await projects.getByRole('option', { name: 'Проект 2', selected: true }).waitFor();
  failures.push(...(await inspect(page, `${label} /channels (проекты)`)));
  await page.getByRole('button', { name: 'Снять всё' }).click();
  assert.equal(await projects.getByRole('option', { selected: true }).count(), 0);
  return failures;
}

async function checkEditorTabs(page, label) {
  const tabs = page.getByRole('tablist', { name: 'Разделы редактора' });
  await tabs.getByRole('tab', { name: 'Редактор' }).press('Home');
  await tabs.getByRole('tab', { name: 'Рецепты', selected: true }).waitFor();
  const failures = await inspect(page, `${label} /editor (рецепты)`);
  await tabs.getByRole('tab', { name: 'Рецепты' }).press('ArrowRight');
  await tabs.getByRole('tab', { name: 'Тестовая схема', selected: true }).waitFor();
  await page.getByRole('button', { name: /^Схема:/ }).click();
  await page.getByRole('button', { name: 'Открепить схему «Тестовая схема»' }).click();
  await page.getByRole('button', { name: 'Закрепить схему «Тестовая схема»' }).waitFor();
  return failures;
}

async function checkEditorPanels(page, label) {
  await page.getByRole('complementary', { name: 'Палитра и слои' }).waitFor();
  await page.getByRole('complementary', { name: 'Свойства', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Свернуть левую панель' }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'left-panel-expand');
  await page.getByRole('button', { name: 'Свернуть панель свойств' }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'right-panel-expand');
  const failures = await inspect(page, `${label} /editor (свёрнутые панели)`);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'right-panel-collapse');
  await page.getByRole('button', { name: /^Развернуть левую панель/ }).press('Enter');
  await page.waitForFunction(() => document.activeElement?.id === 'left-panel-collapse');
  return failures;
}

async function checkPageContrast(page, path, theme) {
  const names = { '/automation': 'Задачи', '/data': 'Таблицы', '/admin': 'Пользователи', '/editor': 'Палитра' };
  const tab = names[path];
  if (tab) await checkContrast(page.getByRole('tab', { name: tab, exact: true }), `${theme} ${path} ${tab}`);
  if (path === '/log' || path === '/actions') {
    const button = page.getByRole('button', { name: 'Показать', exact: true });
    await checkContrast(button, `${theme} ${path} Показать`);
    await button.hover();
    await checkContrast(button, `${theme} ${path} Показать при наведении`);
  }
  if (path === '/log') {
    await checkContrast(page.getByRole('button', { name: 'подробнее', exact: true }).first(), `${theme} ${path} подробнее`);
  }
}

async function checkTheme(browser, origin, colorScheme) {
  const context = await browser.newContext({ colorScheme, viewport: { width: 1366, height: 768 } });
  try {
    await mockWorkspace(context, origin);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const failures = [];
    for (const [path, waitUntilReady] of Object.entries(ready)) {
      await page.goto(origin + path);
      await waitUntilReady(page);
      await page.waitForFunction((theme) => document.documentElement.classList.contains(theme), colorScheme);
      if (path === '/automation' || path === '/data' || path === '/monitor') {
        await page.getByRole('combobox', { name: 'Проект', exact: true }).waitFor();
      }
      assert.equal(await page.getByRole('main').count(), 1);
      if (path === '/automation') {
        await page.keyboard.press('Tab');
        await page.waitForFunction(() => document.activeElement?.getAttribute('href') === '#main-content');
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => document.activeElement?.id === 'main-content');
      }
      failures.push(...(await inspect(page, `${colorScheme} ${path}`)));
      await checkPageContrast(page, path, colorScheme);
      if (path === '/channels') failures.push(...(await checkChannelLists(page, colorScheme)));
      if (path === '/editor') {
        failures.push(...(await checkEditorPanels(page, colorScheme)));
        failures.push(...(await checkEditorTabs(page, colorScheme)));
      }
    }
    assert.deepEqual(errors, [], `Ошибки браузера в теме ${colorScheme}`);
    return failures;
  } finally {
    await context.close();
  }
}

const port = await freePort();
const origin = `http://${host}:${port}`;
const server = spawn(process.execPath, ['.next/standalone/server.js'], {
  env: { ...process.env, PORT: String(port), HOSTNAME: host, NEXT_TELEMETRY_DISABLED: '1' },
  stdio: 'inherit',
  windowsHide: true,
});

let browser;
try {
  await waitForServer(origin, server);
  const channel = process.env.SCADA_A11Y_BROWSER_CHANNEL;
  browser = await chromium.launch(channel ? { channel } : undefined);
  const failures = [];
  for (const colorScheme of ['dark', 'light']) {
    failures.push(...(await checkTheme(browser, origin, colorScheme)));
  }
  assert.deepEqual(failures, [], 'Нарушения доступности в интерфейсе');
  console.log('axe: восемь рабочих разделов в светлой и тёмной теме проверены.');
} finally {
  await browser?.close();
  server.kill();
}
