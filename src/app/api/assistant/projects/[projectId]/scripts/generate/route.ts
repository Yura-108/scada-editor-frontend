import {NextRequest} from "next/server";
import {protectedRoute} from "@/server/auth/protected";
import {proxyAssistant} from "@/server/proxy/assistantProxy";

/** Черновик скрипта по описанию задачи: `POST /api/assistant/projects/{projectId}/scripts/generate`. */
export const POST = protectedRoute(async (req: NextRequest, {token, params}) =>
  proxyAssistant(req, token, params.projectId, "scripts/generate"));
