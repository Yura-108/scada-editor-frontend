import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/channels', '/editor', '/monitor', '/log'];
const authRoutes = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value; // или как ты хранишь токен

  const { pathname } = request.nextUrl;

  // Если пользователь авторизован и пытается зайти на login/register
  if (token && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/channels', request.url));
  }

  // Совпадение только по границе сегмента: голый startsWith('/log') поймал бы и
  // '/login', отправив страницу входа в бесконечный редирект на саму себя.
  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Если не авторизован и пытается зайти
  if (!token && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!token && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Если авторизован и заходит на /
  if (token && pathname === '/') {
    return NextResponse.redirect(new URL('/channels', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/login',
    '/register',
    '/editor/:path*',
    '/channels/:path*',
    '/monitor/:path*',
    '/log/:path*',
  ],
};
