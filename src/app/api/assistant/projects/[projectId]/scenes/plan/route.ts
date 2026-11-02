import {NextRequest} from "next/server";
import {protectedRoute} from "@/server/auth/protected";
import {proxyAssistant} from "@/server/proxy/assistantProxy";

/** План сцены по описанию (только просмотр): `POST /api/assistant/projects/{projectId}/scenes/plan`. */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) =>
  proxyAssistant(req, token, params.projectId, "scenes/plan"));
