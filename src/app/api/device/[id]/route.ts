import { protectedRoute } from "@/lib/protected";
import {NextResponse} from "next/server";

export const DELETE = protectedRoute(async (_request, { token, params }) => {
    const { id } = params;

    const response = await fetch(`${process.env.BACKEND_URL}/api/node/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
        const err = await response.json().catch(() => {});
        return NextResponse.json(
          { error: err?.message || "Ошибка удаления" },
          { status: response.status }
        );
    }

    return new NextResponse(null, { status: 204 });
});