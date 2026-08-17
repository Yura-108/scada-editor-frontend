import {protectedRoute} from "@/lib/protected";
import { backendErrorResponse } from '@/lib/backendProxy';
import {NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL_EDITOR || 'http://localhost:8080';

export const GET = protectedRoute(async (_request, {token, params}) => {
  const {id} = params;

  const response = await fetch(`${BACKEND_URL}/api/editor/recipes/${id}/resolved`, {
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
