import { callAuth } from '@/lib/auth';
import { setTokenCookie } from '@/lib/setTokenCookies';

export async function POST(request: Request) {
  const body = await request.json();
  const { ok, status, data } = await callAuth('/api/auth/register', body);

  if (!ok) {
    return Response.json({ message: data.message ?? 'Не удалось зарегистрироваться' }, { status });
  }

  const token = (data.token ?? data.accessToken) as string | undefined;
  if (!token) {
    return Response.json({ message: 'Бэкенд не вернул токен' }, { status: 502 });
  }

  return setTokenCookie(token);
}
