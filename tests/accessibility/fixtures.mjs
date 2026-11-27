const scene = { id: 270, name: 'Тестовая схема' };
const project = {
  id: 27,
  name: 'Тестовый проект',
  access: { view: true, edit: true, operate: true, level: 10 },
  image: { pinnedScenes: { ids: [scene.id], recipesIndex: 0 } },
};
const logEntry = {
  userName: 'fixture-operator',
  entityType: 'NODE',
  entityId: 30,
  commandType: 'UPDATE_NODE',
  payload: { name: 'Устройство' },
  undoPayload: { name: 'Другое имя' },
  createdAt: '2026-11-20T12:00:00',
  batchId: 'test-batch',
};

const responses = new Map([
  ['/api/editor/projects', [project]],
  ['/api/editor/projects/27/runtime', { inOperation: true, prodVersionNo: 1 }],
  ['/api/editor/scene', [scene]],
  ['/api/editor/scene/270', { ...scene, project_id: 27, type: 'scene', children: [] }],
  ['/api/editor/data/27', { version: 1, tables: [] }],
  ['/api/editor/automation/27', { version: 1, tasks: [], variables: [], watchdog: null }],
  ['/api/device/site', Array.from({ length: 9 }, (_, i) => `Площадка ${i + 1}`)],
  ['/api/logs', [1, 2].map((id) => ({ ...logEntry, id, sequence: id }))],
]);

export async function mockWorkspace(context, origin) {
  // Тестовая сессия нужна только фронтенду. Запросы API и WS не выходят за пределы браузера.
  const claims = Buffer.from(
    JSON.stringify({ sub: 'fixture-operator', admin: true, exp: Math.floor(Date.now() / 1000) + 600 }),
  ).toString('base64url');
  await context.addCookies([{ name: 'access_token', value: `fixture.${claims}.fixture`, url: origin }]);
  await context.addInitScript(() => localStorage.setItem('scada.lastProjectId', '27'));
  await context.routeWebSocket('**/*', (socket) => socket.close());
  await context.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/$/, '');
    if (path === '/api/device/hierarchy') {
      await route.fulfill({
        json: {
          nodes: ['Проект 1', 'Проект 2'].map((name) => ({ key: `${url.searchParams.get('site')}.${name}` })),
          params: [],
        },
      });
      return;
    }
    await route.fulfill({ json: responses.get(path) ?? [] });
  });
}
