import {NextResponse} from "next/server";

export function setTokenCookie(token: string) {
  const response = NextResponse.json({message: "Успешно"}, {status: 200});

  response.cookies.set({
    name: "access_token",
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
  });

  return response;
}