import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { callAuth } from '@/server/auth/auth';
import { REFRESH_COOKIE, clearSessionCookies } from '@/server/auth/setTokenCookies';

export async function POST(request: Request) {
  // Гасим цепочку этого входа на бэкенде: refresh-токен больше не обновится. Уже выданный
  // access доживает свой срок — сразу гасит только «Завершить сеансы» в админке.
  const refreshToken = (await cookies()).get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    // Ошибку связи глотаем: выход всё равно состоится, cookie стираем ниже.
    await callAuth('/api/auth/logout', { refreshToken }).catch(err => {
      console.warn('[auth] не удалось отозвать вход на бэкенде:', err);
    });
  }

  const response = NextResponse.json({ message: 'Выход выполнен' }, { status: 200 });
  // С теми же атрибутами, что при входе, иначе браузер их не перезапишет.
  clearSessionCookies(response.cookies, request);
  return response;
}
