import { NextResponse } from "next/server";
import { authenticate, signSession, SESSION_COOKIE } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  const res = NextResponse.json({ user });
  res.cookies.set(SESSION_COOKIE, signSession(user.id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
  return res;
}
