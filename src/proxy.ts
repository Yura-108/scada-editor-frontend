import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { resolveSession } from '@/server/auth/sessionRefresh';
import { ACCESS_COOKIE, REFRESH_COOKIE, clearSessionCookies, setSessionCookies } from '@/server/auth/setTokenCookies';

const protectedRoutes = ['/channels', '/editor', '/monitor', '/automation', '/data', '/log', '/actions', '/admin'];
const authRoutes = ['/login'];

export async function proxy(request: NextRequest) {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  const { pathname } = request.nextUrl;

  // Признак «вошёл» для страницы входа — любая из двух cookie: access живёт 8 часов, refresh —
  // неделю, и обновит пару уже защищённая страница, куда уводим.
  if (authRoutes.includes(pathname)) {
    return access || refresh ? NextResponse.redirect(new URL('/channels', request.url)) : NextResponse.next();
  }

  // Совпадение только по границе сегмента: голый startsWith('/log') поймал бы и
  // '/login', отправив страницу входа в бесконечный редирект на саму себя.
  const isProtected = pathname === '/' || protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!isProtected) return NextResponse.next();

  const session = await resolveSession(access, refresh);

  // Не вошёл или refresh-токен погашен — на вход; мёртвые cookie стираем, иначе /login
  // принял бы их за вход и вернул сюда же.
  if (session.kind === 'dead') {
    const response = NextResponse.redirect(new URL('/login', request.url));
    if (access || refresh) clearSessionCookies(response.cookies, request);
    return response;
  }

  // Новую пару — и в запрос: серверные компоненты этого же рендера (`getUser`) читают cookie
  // запроса и иначе увидели бы старую.
  if (session.kind === 'refreshed') {
    request.cookies.set(ACCESS_COOKIE, session.pair.token);
    if (session.pair.refreshToken) request.cookies.set(REFRESH_COOKIE, session.pair.refreshToken);
  }

  // auth не ответил (`unavailable`) — пускаем: на вход не выкидываем из‑за моргнувшего gateway,
  // запросы страницы сами получат 503 или 401.
  const response = pathname === '/'
    ? NextResponse.redirect(new URL('/channels', request.url))
    : NextResponse.next({ request: { headers: request.headers } });
  if (session.kind === 'refreshed') setSessionCookies(response.cookies, session.pair, request);
  return response;
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/editor/:path*',
    '/channels/:path*',
    '/monitor/:path*',
    '/automation/:path*',
    '/data/:path*',
    '/log/:path*',
    '/actions/:path*',
    '/admin/:path*',
  ],
};
