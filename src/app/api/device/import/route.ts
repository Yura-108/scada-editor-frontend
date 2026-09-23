import {protectedRoute} from "@/lib/protected";
import { backendErrorResponse } from '@/lib/backendProxy';
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Импорт базы каналов из .cdbx (+ необязательные main.io.lua / main.objects.lua).
// Форму пересылаем целиком и Content-Type руками не ставим — boundary проставит fetch.
export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const form = await req.formData();

  const response = await fetch(`${BACKEND_URL}/api/channel/import/cdbx`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  if (!response.ok) return backendErrorResponse(response);

  return NextResponse.json(await response.json());
});
