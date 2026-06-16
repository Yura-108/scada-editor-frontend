import {cookies} from "next/headers";

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) return null;

  return true;
}