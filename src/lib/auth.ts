const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function callAuth(path: string, body: { login: string; password: string }) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // Ошибку НЕ бросаем: роут должен уметь вернуть клиенту статус и сообщение бэкенда.
  // При throw ветка `if (!ok)` в роуте недостижима, а 401 превращается в HTML-500 Next.js,
  // и реальная причина («неверный логин или пароль») до пользователя не доходит.
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Бэкенд ответил не-JSON (например, HTML страницей ошибки) — сохраняем текст как сообщение.
    data = { message: text || `Ошибка ${response.status}` };
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
