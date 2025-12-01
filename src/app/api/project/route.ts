import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");
  const project = searchParams.get("project");

  if (!site || !project) {
    return NextResponse.json({ message: "Bad request" }, { status: 400 });
  }

  const backendUrl = `${process.env.BACKEND_URL}/api/node/all?site=${site}&project=${project}`;

  const res = await fetch(backendUrl);


  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return NextResponse.json(data || { message: "Server error" }, { status: res.status });
  }

  return NextResponse.json(data);
}
