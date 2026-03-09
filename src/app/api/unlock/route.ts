import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const POST = protectedRoute(async (req: NextRequest, {token}) => {
  const editingDevicesKeys = await req.json();
  console.log(editingDevicesKeys);
  if (!editingDevicesKeys) {
    return NextResponse.json(
      {error: "Массив пуст!"},
      {status: 400}
    );
  }

  const response = await fetch(`${BACKEND_URL}/api/channel/unlock`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(editingDevicesKeys),
  });
  const unlockedDevices = await response.json().catch(() => null);

  return NextResponse.json(unlockedDevices, {status: 201});
})
