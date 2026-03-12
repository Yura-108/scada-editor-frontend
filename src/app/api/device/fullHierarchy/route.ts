import {protectedRoute} from "@/lib/protected";
import {NextRequest, NextResponse} from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET = protectedRoute(async (req: NextRequest, {token}) => {
  const {searchParams} = new URL(req.url);
  const project = searchParams.get('project');

  const response = await fetch(
    `${BACKEND_URL}/api/channel/node/fullHierarchy?rootPath=${project}`,
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