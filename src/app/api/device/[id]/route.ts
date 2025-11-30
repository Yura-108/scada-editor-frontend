import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('access_token')?.value;
    const {id} = await params;

    if (!accessToken) {
        return NextResponse.json({message: 'Unauthorized'}, {status: 401});
    }

    if (!id) {
        return NextResponse.json({ message: 'ID обязателен' }, { status: 400 });
    }

    const backendUrl = `${process.env.BACKEND_URL}/api/node/${id}`;

    try {
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${accessToken}`, // ← передаём токен
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            return NextResponse.json(
                { error: data?.message || "Ошибка при удалении узла" },
                { status: response.status }
            );
        }

        return new NextResponse(null, { status: 204 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ error: "Ошибка при удалении" }, { status: 500 });
    }
}