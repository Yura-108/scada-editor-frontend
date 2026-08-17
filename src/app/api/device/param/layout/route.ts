import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const response = await fetch(`${BACKEND_URL}/api/channel/param/description`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});
