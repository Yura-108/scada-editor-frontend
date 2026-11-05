import type { NextConfig } from 'next';

/**
 * Защитные заголовки страниц и API (#20 п. 2).
 *
 * Сразу действуют: запрет встраивания в чужую страницу (`frame-ancestors 'none'` и
 * `X-Frame-Options` — монитор нельзя открыть в чужом `<iframe>` и подсунуть оператору клик по
 * кнопке управления), `nosniff`, `Referrer-Policy`.
 *
 * Полная CSP — пока только отчётом (`…-Report-Only`): нарушения видны в консоли браузера, но
 * ничего не блокируется. Сразу включить её нельзя: Next вставляет встроенные скрипты, а gateway —
 * тот же хост на другом порту, который на этапе сборки неизвестен (см. `shared/lib/gatewayOrigin.ts`).
 *
 * `'unsafe-eval'` странице больше не нужен (#20 п. 1, шаг 6): скрипты схем исполняет воркер-песочница
 * со своей политикой (ниже), синтаксис проверяет acorn, zod — без JIT. Остаётся только в dev:
 * там им пользуются инструменты разработки React и Next, и отчёт был бы шумом.
 * Когда отчёты на стенде чистые — переносим политику в `Content-Security-Policy`, сужая
 * `connect-src` до хоста страницы — уже в `proxy.ts`, где хост запроса известен.
 */
const GATEWAY_PORT = process.env.NEXT_PUBLIC_GATEWAY_PORT ?? '8080';

const gatewaySources = [
  `http://*:${GATEWAY_PORT}`, `https://*:${GATEWAY_PORT}`,
  `ws://*:${GATEWAY_PORT}`, `wss://*:${GATEWAY_PORT}`,
  process.env.NEXT_PUBLIC_GATEWAY_URL, process.env.NEXT_PUBLIC_RUNTIME_WS_URL,
].filter(Boolean);

const devEval = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : '';

const reportOnlyCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${devEval}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${gatewaySources.join(' ')}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * Политика воркера-песочницы скриптов схем (`public/sandbox/worker.js`, #20 п. 1): у кода схемы
 * нет ни сети (`connect-src` через `default-src 'none'` — `fetch`, WebSocket, …), ни загрузки
 * скриптов (`import()`, `importScripts` — ни один источник не разрешён). `'unsafe-eval'` — сами
 * скрипты схем компилируются через `new Function`. Это второй слой: первый — `lockDownWorkerScope`.
 * Действует, только пока воркер загружается по своему адресу, а не из blob-URL.
 */
const sandboxWorkerHeaders = [
  { key: 'Content-Security-Policy', value: "default-src 'none'; script-src 'unsafe-eval'" },
];

const securityHeaders = [
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Content-Security-Policy-Report-Only', value: reportOnlyCsp },
];

const nextConfig: NextConfig = {
  output: 'standalone',
  // `X-Powered-By: Next.js` подсказывал, чем и какой версией атаковать.
  poweredByHeader: false,
  // Ошибки типов роняют сборку: их 0, и ошибка в проверке прав не пройдёт незамеченной
  // (#20 п. 5). Раньше здесь стоял `ignoreBuildErrors: true`.
  async headers() {
    // Порядок важен: из двух правил с одним заголовком действует последнее.
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sandbox/worker.js', headers: sandboxWorkerHeaders },
    ];
  },
};

export default nextConfig;
