import { protectedRoute } from "@/lib/protected";
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

// Отмена всего пакета изменений разом (устройство + связанные параметры).
// Проксирует запрос на бэкенд: POST /api/channel/undo/batch/{batchId}
export const POST = protectedRoute(async (_req: NextRequest, { token, params }) => {
  try {
    const { batchId } = params;

    if (!batchId) {
      return NextResponse.json({ error: 'Missing batchId' }, { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/api/channel/undo/batch/${batchId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log('--- BACKEND ERROR REPORT (batch undo) ---');
      console.log('Status:', response.status);
      console.log('Message from Backend:', errorText);
      console.log('-----------------------------------------');

      return NextResponse.json(
        { error: `Backend error: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data);

  } catch (error) {
    console.error('Route Error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
});
