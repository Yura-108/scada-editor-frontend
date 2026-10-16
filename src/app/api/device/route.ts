import {NextRequest, NextResponse} from 'next/server';
import {protectedRoute} from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

 export const POST = protectedRoute(async (req: NextRequest, {token}) => {
   const node = await req.json();

   if (!node) {
     return NextResponse.json(
       {error: "Неверный тип узла!"},
       {status: 400}
     );
   }

   const response = await fetch(`${BACKEND_URL}/api/channel/node`, {
     method: 'POST',
     headers: {
       Authorization: `Bearer ${token}`,
       'Content-Type': 'application/json',
     },
     body: JSON.stringify(node),
   });

   const newDevice = await response.json().catch(() => null);

   return NextResponse.json(newDevice, {status: 201});
 })
