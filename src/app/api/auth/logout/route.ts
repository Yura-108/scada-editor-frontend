import { NextResponse } from 'next/server';
import { isHttpsRequest } from '@/lib/setTokenCookies';

export async function POST(request: Request) {
  const response = NextResponse.json({ message: 'Выход выполнен' }, { status: 200 });

  // Удаляем httpOnly cookie — с теми же атрибутами, что при входе, иначе браузер её не перезапишет
  response.cookies.set({
    name: 'access_token',
    value: '',
    httpOnly: true,
    secure: isHttpsRequest(request),
    path: '/',
    maxAge: 0, // сразу истекает
    sameSite: 'lax',
  });

  return response;
}
