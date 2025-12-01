import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

 export const GET = protectedRoute(async (req: NextRequest, {token}) => {
   const {searchParams} = new URL(req.url);
   const site = searchParams.get('site');
   const project = searchParams.get('project');

   if (!site || !project) {
     return NextResponse.json({message: 'Bad request'}, {status: 400});
   }

   const response = await fetch(`${BACKEND_URL}/api/node/all?site=${site}&project=${project}`, {
     method: 'GET',
     headers: {
      Authorization: `Bearer ${token}`, // ← передаём токен
      'Content-Type': 'application/json',
    },
   });

   if (!response.ok) {
     const text = await response.text();
     throw new Error(`Ошибка ${response.status}: ${text}`);
   }

   const data = await response.json().catch(() => null);

   return NextResponse.json(data);
 });

 export const POST = protectedRoute(async (req: NextRequest, {token}) => {
   const node = await req.json();

   if (!node) {
     return NextResponse.json(
       {error: "Неверный тип узла!"},
       {status: 400}
     );
   }

   const response = await fetch(`${BACKEND_URL}/api/node`, {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${token}`, // ← передаём токен
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(node),
   });

   const newDevice = await response.json().catch(() => null);

   return NextResponse.json(newDevice, {status: 201});
 })
