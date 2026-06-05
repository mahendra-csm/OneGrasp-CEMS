// Helpers for route handlers: resolve the current user from the session cookie
// and gate admin-only endpoints. Server-only.
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "./store";

export async function currentUser() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

// Returns { user } on success, or { error: <NextResponse> } to short-circuit.
export async function requireUser() {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user };
}

export async function requireAdmin() {
  const user = await currentUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (user.role !== "admin")
    return { error: NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 }) };
  return { user };
}
