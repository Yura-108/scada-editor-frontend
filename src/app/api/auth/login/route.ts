import {setTokenCookie} from "@/lib/setTokenCookies";
import {callAuth} from "@/lib/auth";

export async function POST(request: Request) {
  const body = await request.json();
  console.log(body)
  const { ok, status, data } = await callAuth("/api/auth/login", body);

  if (!ok) {
    return Response.json({ message: data.message }, { status });
  }

  const token = data.token || data.accessToken;
  return setTokenCookie(token);
}
