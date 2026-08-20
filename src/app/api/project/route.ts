import { NextRequest, NextResponse } from "next/server";
import { protectedRoute } from "@/lib/protected";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export const GET = protectedRoute(async (request: NextRequest, { token }) => {
  const { searchParams } = new URL(request.url);
  const site = searchParams.get("site");
  const project = searchParams.get("project");

  if (!site || !project) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const backendUrl = `${BACKEND_URL}/api/channel/node/all?site=${encodeURIComponent(site)}&project=${encodeURIComponent(project)}`;

  const res = await fetch(backendUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(data || { message: "Server error" }, { status: res.status });
  }

  return NextResponse.json(data);
});
