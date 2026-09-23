import {protectedRoute} from "@/lib/protected";
import { backendErrorResponse } from '@/lib/backendProxy';
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Удаление проекта, созданного импортом .cdbx. Next отдаёт params уже
// декодированными, а площадка кириллическая — кодируем заново.
export const DELETE = protectedRoute(async (_req: NextRequest, {token, params}) => {
  const {site, project} = params as {site: string; project: string};

  const response = await fetch(
    `${BACKEND_URL}/api/channel/import/${encodeURIComponent(site)}/${encodeURIComponent(project)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  if (!response.ok) return backendErrorResponse(response);

  return new NextResponse(null, { status: 204 });
});
