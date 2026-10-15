import {cookies} from "next/headers";
import {decodeJwtClaims} from "@/lib/protected";

export interface SessionUser {
  login: string;
  /** Claim `admin` из JWT: только чтобы показать «Администрирование». */
  admin: boolean;
}

/** Пользователь из cookie (без проверки подписи — её делает бэкенд); `null` — не вошёл. */
export async function getUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) return null;

  const claims = decodeJwtClaims(token) ?? {};
  return {
    login: typeof claims.sub === "string" ? claims.sub : "",
    admin: claims.admin === true,
  };
}
