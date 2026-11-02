import {NextRequest} from "next/server";
import {protectedRoute} from "@/server/auth/protected";
import {proxyAssistant} from "@/server/proxy/assistantProxy";

/** Массовая правка скриптов: предложения по каждому скрипту: `POST /api/assistant/projects/{projectId}/scripts/edit`. */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) =>
  proxyAssistant(req, token, params.projectId, "scripts/edit"));
