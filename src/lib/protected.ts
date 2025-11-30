import {NextRequest, NextResponse} from "next/server";
import {cookies} from "next/headers";

type Handler<T = any> = (
  request: NextRequest,
  ctx: {token: string, params: any}
) => Promise<NextResponse<T>>;

export function protectedRoute(handler: Handler) {
  return async (request: NextRequest, {params}: {params: Promise<any>}) => {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;

    return handler(request, {token, params: resolvedParams});
  }
}