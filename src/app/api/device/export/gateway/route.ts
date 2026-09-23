import {protectedRoute} from "@/lib/protected";
import { backendErrorResponse } from '@/lib/backendProxy';
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Выгрузка тегов проекта блоком для controllers.yaml шлюза (text/plain).
export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const {searchParams} = new URL(req.url);
  const query = new URLSearchParams();
  for (const name of ['root', 'controllerId', 'endpoint']) {
    const value = searchParams.get(name);
    if (value) query.set(name, value);
  }

  const response = await fetch(`${BACKEND_URL}/api/channel/export/gateway?${query}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return backendErrorResponse(response);

  return new NextResponse(await response.text(), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
});
