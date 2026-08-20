import {NextRequest, NextResponse} from 'next/server';
import { backendErrorResponse } from '@/lib/backendProxy';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_req: NextRequest, {token}) => {
  const response = await fetch(`${BACKEND_URL}/api/editor/components/projects`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) return backendErrorResponse(response);

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
});
