import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const protectedRoutes = ['/app', '/editor'];
const authRoutes = ['/login', '/register'];

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value; // или как ты хранишь токен

  const { pathname } = request.nextUrl;

  // Если пользователь авторизован и пытается зайти на login/register
  if (token && authRoutes.includes(pathname)) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  // Если не авторизован и пытается зайти в /app/*
  if (!token && protectedRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (!token && pathname === '/') {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Если авторизован и заходит на /
  if (token && pathname === '/') {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/register', '/app/:path*'],
};
