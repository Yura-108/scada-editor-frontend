import type { NextConfig } from 'next';

/**
 * Защитные заголовки страниц и API (#20 п. 2).
 *
 * Сразу действуют: запрет встраивания в чужую страницу (`frame-ancestors 'none'` и
 * `X-Frame-Options` — монитор нельзя открыть в чужом `<iframe>` и подсунуть оператору клик по
 * кнопке управления), `nosniff`, `Referrer-Policy`.
 *
 * Полная CSP — пока только отчётом (`…-Report-Only`): нарушения видны в консоли браузера, но
 * ничего не блокируется. Сразу включить её нельзя: скрипты схем исполняются через `new Function`
 * (нужен `'unsafe-eval'`, см. #20 п. 1), Next вставляет встроенные скрипты, а gateway — тот же
 * хост на другом порту, который на этапе сборки неизвестен (см. `shared/lib/gatewayOrigin.ts`).
 * Когда отчёты на стенде чистые — переносим политику в `Content-Security-Policy`, сужая
 * `connect-src` до хоста страницы — уже в `proxy.ts`, где хост запроса известен.
 */
const GATEWAY_PORT = process.env.NEXT_PUBLIC_GATEWAY_PORT ?? '8080';

const gatewaySources = [
  `http://*:${GATEWAY_PORT}`, `https://*:${GATEWAY_PORT}`,
  `ws://*:${GATEWAY_PORT}`, `wss://*:${GATEWAY_PORT}`,
  process.env.NEXT_PUBLIC_GATEWAY_URL, process.env.NEXT_PUBLIC_RUNTIME_WS_URL,
].filter(Boolean);

const reportOnlyCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
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
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
