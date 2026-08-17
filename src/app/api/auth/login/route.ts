import { setTokenCookie } from '@/lib/setTokenCookies';
import { callAuth } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { ok, status, data } = await callAuth('/api/auth/login', body);

  if (!ok) {
    return Response.json({ message: data.message ?? 'Неверный логин или пароль' }, { status });
  }

  const token = (data.token ?? data.accessToken) as string | undefined;
  if (!token) {
    return Response.json({ message: 'Бэкенд не вернул токен' }, { status: 502 });
  }

  return setTokenCookie(token);
}
