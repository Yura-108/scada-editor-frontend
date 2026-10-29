import { parseSessionPair, setTokenCookie } from '@/server/auth/setTokenCookies';
import { callAuth } from '@/server/auth/auth';

export async function POST(request: Request) {
  const body = await request.json();
  const { ok, status, data, retryAfter } = await callAuth('/api/auth/login', body);

  // 10 неудачных попыток за 15 минут — учётка закрыта до конца окна, даже с верным паролем.
  if (status === 429) {
    const minutes = Math.max(1, Math.ceil((retryAfter ?? 60) / 60));
    return Response.json(
      { message: `Слишком много неудачных попыток, повторите через ${minutes} мин.` },
      { status, headers: retryAfter != null ? { 'Retry-After': String(retryAfter) } : undefined },
    );
  }

  if (!ok) {
    return Response.json({ message: data.message ?? 'Неверный логин или пароль' }, { status });
  }

  const pair = parseSessionPair(data);
  if (!pair) {
    return Response.json({ message: 'Бэкенд не вернул токен' }, { status: 502 });
  }

  return setTokenCookie(pair, request);
}
