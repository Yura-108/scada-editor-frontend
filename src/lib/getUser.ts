import {cookies} from "next/headers";

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8080';

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) return null;

  return true;
}