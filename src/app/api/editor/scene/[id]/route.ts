import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

function parseProjectId(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('project_id') ?? searchParams.get('projectId');
  if (raw === null || raw === '') return null;

  const projectId = Number(raw);
  if (!Number.isSafeInteger(projectId)) return null;

  return projectId;
}

export const GET = protectedRoute(async (req: NextRequest, {token, params}) => {
  const {id} = params;

  // Иерархия Проект -> Схема: project_id обязателен, чтобы бэкенд
  // мог валидировать, что запрашиваемая сцена принадлежит проекту.
  const projectId = parseProjectId(req.nextUrl.searchParams);
  if (projectId === null) {
    return NextResponse.json(
      {error: "Параметр project_id обязателен и должен быть целым числом (int64)"},
      {status: 400}
    );
  }

  const response = await fetch(
    `${BACKEND_URL}/api/editor/components/${id}?project_id=${projectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const DELETE = protectedRoute(async (req: NextRequest, {token, params}) => {
  const {id} = params;

  const projectId = parseProjectId(req.nextUrl.searchParams);
  if (projectId === null) {
    return NextResponse.json(
      {error: "Параметр project_id обязателен и должен быть целым числом (int64)"},
      {status: 400}
    );
  }

  const response = await fetch(
    `${BACKEND_URL}/api/editor/components/scene/${id}?project_id=${projectId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  return NextResponse.json({success: true});
});