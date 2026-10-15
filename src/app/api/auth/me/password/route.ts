import {NextRequest} from "next/server";
import {protectedRoute} from "@/lib/protected";
import {proxyAuth} from "@/lib/authProxy";

/** Смена своего пароля: `{oldPassword, newPassword}` → 204; неверный текущий — 400. */
export const PUT = protectedRoute(async (req: NextRequest, {token}) =>
  proxyAuth(req, token, "/api/auth/me/password"));
