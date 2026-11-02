import {NextRequest} from "next/server";
import {protectedRoute} from "@/server/auth/protected";
import {proxyAssistant} from "@/server/proxy/assistantProxy";

/** Подбор тега по описанию: предложение и кандидаты из каталога: `POST /api/assistant/projects/{projectId}/tags/resolve`. */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) =>
  proxyAssistant(req, token, params.projectId, "tags/resolve"));
