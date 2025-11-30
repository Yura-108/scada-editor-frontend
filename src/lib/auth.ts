const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function callAuth(path: string, body: { login: string; password: string }) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}
