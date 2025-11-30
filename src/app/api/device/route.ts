import {NextRequest, NextResponse} from 'next/server';
import {cookies} from "next/headers";
import {protectedRoute} from "@/lib/protected";

 export const GET = protectedRoute(async (req: NextRequest, {token}) => {
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

   const backendUrl = `${process.env.BACKEND_URL}/api/node`;

   const response = await fetch(backendUrl, {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${token}`, // ← передаём токен
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(node),
   });

   const newDevice = response.json();

   return NextResponse.json(newDevice, {status: 201});
 })


// Создать новое устройство
// export async function POST(req: NextRequest) {
//   try {
//     const node = await req.json();
//
//     if (!node) {
//       return NextResponse.json(
//         {error: "Неверный тип узла!"},
//         {status: 400}
//       );
//     }
//
//     console.log(node);
//
//     const backendUrl = `${process.env.BACKEND_URL}/api/node`;
//
//     const response = await fetch(backendUrl, {
//       method: 'POST',
//       headers: {'Content-Type': 'application/json'},
//       body: JSON.stringify(node),
//     });
//
//     const newDevice = response.json();
//
//     return NextResponse.json(newDevice, {status: 201});
//   } catch (err) {
//     console.error(err);
//     return NextResponse.json(
//       {error: "Ошибка при создании устройства"},
//       {status: 500}
//     );
//   }
// }
