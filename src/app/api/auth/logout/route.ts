import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Выход выполнен' }, { status: 200 });

  // Удаляем httpOnly cookie
  response.cookies.set({
    name: 'access_token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0, // сразу истекает
    sameSite: 'lax',
  });

  return response;
}
