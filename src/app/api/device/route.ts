import { NextRequest, NextResponse } from 'next/server';
import {DeviceNodeType} from "@/types/nodeTypes";

// Получить список всех устройств
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get('site');
  const project = searchParams.get('project');

  if (!site || !project) {
    return NextResponse.json({ message: 'Bad request' }, { status: 400 });
  }

  const backendUrl = `${process.env.BACKEND_URL}/api/node/all?site=${site}&project=${project}`;

  const res = await fetch(backendUrl);

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(data || { message: 'Server error' }, { status: res.status });
  }

  return NextResponse.json(data);
}

// Создать новое устройство
export async function POST(req: NextRequest) {
    try {
        const node: DeviceNodeType = await req.json();

        if (!node) {
            return NextResponse.json(
                { error: "Название обязательно" },
                { status: 400 }
            );
        }

        const backendUrl = `${process.env.BACKEND_URL}/api/node`;

        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(node),
        });

        const newDevice = response.json();

        return NextResponse.json(newDevice, {status: 201});
    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: "Ошибка при создании устройства" },
            { status: 500 }
        );
    }
}
