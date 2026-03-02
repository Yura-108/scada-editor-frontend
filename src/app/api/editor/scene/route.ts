import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, {token}) => {

  const response = await fetch(`${BACKEND_URL}/api/components/scene`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const sceneName = await req.json();

  if (!sceneName) {
    return NextResponse.json(
      {error: "Имя сцены не валидное!"},
      {status: 400}
    );
  }

  console.log(sceneName);

  const response = await fetch(`${BACKEND_URL}/api/components/scene`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(sceneName),
  });

  const scene = await response.json().catch(() => null);

  return NextResponse.json(scene, {status: 201});
})
