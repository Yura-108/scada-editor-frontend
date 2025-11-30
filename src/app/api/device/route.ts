import {NextRequest, NextResponse} from 'next/server';
import {DeviceNodeType} from "@/types/nodeTypes";
import {cookies} from "next/headers";

// Получить список всех устройств
export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  if (!accessToken) {
    return NextResponse.json({message: 'Unauthorized'}, {status: 401});
  }


  const {searchParams} = new URL(req.url);
  const site = searchParams.get('site');
  const project = searchParams.get('project');

  if (!site || !project) {
    return NextResponse.json({message: 'Bad request'}, {status: 400});
  }

  const backendUrl = `${process.env.BACKEND_URL}/api/node/all?site=${site}&project=${project}`;

  const response = await fetch(backendUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ошибка ${response.status}: ${text}`);
  }

  const data = await response.json().catch(() => null);

  return NextResponse.json(data);
}

// Создать новое устройство
export async function POST(req: NextRequest) {
  try {
    const node: DeviceNodeType = await req.json();

    if (!node) {
      return NextResponse.json(
        {error: "Название обязательно"},
        {status: 400}
      );
    }

    const backendUrl = `${process.env.BACKEND_URL}/api/node`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(node),
    });

    const newDevice = response.json();

    return NextResponse.json(newDevice, {status: 201});
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      {error: "Ошибка при создании устройства"},
      {status: 500}
    );
  }
}
