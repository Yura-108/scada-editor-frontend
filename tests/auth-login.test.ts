import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/auth/login/route';

const fetchBackend = vi.fn<typeof fetch>();

const loginRequest = (body: string, contentType = 'application/json') =>
  new Request('http://frontend.test/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body,
  });

beforeEach(() => {
  fetchBackend.mockReset();
  vi.stubGlobal('fetch', fetchBackend);
});

afterEach(() => vi.unstubAllGlobals());

describe('POST /api/auth/login', () => {
  it.each([
    ['обрезанный JSON', '{"login":', 'application/json'],
    ['пустое тело', '', 'application/json'],
    ['текст вместо JSON', 'abc', 'application/json'],
    ['обычный текст', 'abc', 'text/plain'],
  ])('возвращает 400 за %s без вызова gateway', async (_, body, contentType) => {
    const response = await POST(loginRequest(body, contentType));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Некорректный запрос' });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('передаёт корректный JSON в gateway и выставляет cookie при успешном входе', async () => {
    const credentials = JSON.stringify({ login: 'test-user', password: 'test-password' });
    fetchBackend.mockResolvedValueOnce(Response.json({ token: 'test-token' }));

    const response = await POST(loginRequest(credentials));

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('access_token=test-token');
    expect(fetchBackend).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/api\/auth\/login$/),
      expect.objectContaining({ body: credentials, method: 'POST' }),
    );
  });
});
