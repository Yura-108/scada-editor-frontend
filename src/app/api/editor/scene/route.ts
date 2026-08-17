import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

function parseProjectId(searchParams: URLSearchParams): number | null {
  const raw = searchParams.get('project_id') ?? searchParams.get('projectId');
  if (raw === null || raw === '') return null;

  const projectId = Number(raw);
  if (!Number.isSafeInteger(projectId)) return null;

  return projectId;
}

export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const projectId = parseProjectId(req.nextUrl.searchParams);

  if (projectId === null) {
    return NextResponse.json(
      {error: "Параметр project_id обязателен и должен быть целым числом (int64)"},
      {status: 400}
    );
  }
  const response = await fetch(
    `${BACKEND_URL}/api/editor/components/scenes?projectId=${projectId}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const scenePayload = await req.json();

  if (!scenePayload?.name) {
    return NextResponse.json(
      {error: "Имя сцены не валидное!"},
      {status: 400}
    );
  }

  const projectId = scenePayload.project_id ?? scenePayload.projectId;
  const body = {
    name: scenePayload.name,
    ...(projectId != null ? {project_id: Number(projectId)} : {}),
  };

  const response = await fetch(`${BACKEND_URL}/api/editor/components/scene`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Пробрасываем реальный статус и тело бэкенда — иначе клиент получает 201 с мусором
  // вместо сцены и store указывает на несуществующую сцену. Пересборка тела в
  // {error: "Ошибка N: …"} прятала `message` от parseBackendErrorMessage.
  if (!response.ok) return backendErrorResponse(response);

  const scene = await response.json().catch(() => null);

  return NextResponse.json(scene, {status: 201});
});
