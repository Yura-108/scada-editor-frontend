import {NextRequest, NextResponse} from "next/server";

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {

    const key = params.id;

    if (!key) {
        return NextResponse.json({ message: 'ID обязателен' }, { status: 400 });
    }

    const backendUrl = `${process.env.BACKEND_URL}/api/node/${key}`;

    try {
        const response = await fetch(backendUrl, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                Cookie: request.headers.get('cookie') || '',
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