import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/editor/projects/route';

const { getCookie } = vi.hoisted(() => ({ getCookie: vi.fn() }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: getCookie }),
}));

const fetchBackend = vi.fn<typeof fetch>();

function requestProjects() {
  return GET(new NextRequest('http://frontend.test/api/editor/projects'), {
    params: Promise.resolve({}),
  });
}

function setTestSession() {
  const claims = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString(
    'base64url',
  );
  const token = ['test-header', claims, 'test-signature'].join('.');
  getCookie.mockImplementation((name: string) =>
    name === 'access_token' ? { value: token } : undefined,
  );
  return token;
}

beforeEach(() => {
  getCookie.mockReset();
  fetchBackend.mockReset();
  vi.stubGlobal('fetch', fetchBackend);
});

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/editor/projects', () => {
  it('возвращает 401 без сессии и не обращается к gateway', async () => {
    const response = await requestProjects();

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Unauthorized' });
    expect(fetchBackend).not.toHaveBeenCalled();
  });

  it('передаёт сессию gateway и возвращает проекты с их правами', async () => {
    const token = setTestSession();
    const projects = [{ id: 7, access: { view: true, edit: false, operate: false } }];
    fetchBackend.mockResolvedValueOnce(Response.json(projects));

    const response = await requestProjects();

    expect(fetchBackend).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(/\/api\/editor\/components\/projects$/),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: `Bearer ${token}` }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(projects);
  });

  it('сохраняет статус 403 и причину отказа в доступе', async () => {
    setTestSession();
    const denial = { error: 'FORBIDDEN', reason: 'NO_PROJECT_ACCESS' };
    fetchBackend.mockResolvedValueOnce(Response.json(denial, { status: 403 }));

    const response = await requestProjects();

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual(denial);
  });

  it('возвращает статус 503 и JSON при пустом ответе gateway', async () => {
    setTestSession();
    fetchBackend.mockResolvedValueOnce(new Response(null, { status: 503 }));

    const response = await requestProjects();

    expect(response.status).toBe(503);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ message: 'Ошибка 503' });
  });
});
