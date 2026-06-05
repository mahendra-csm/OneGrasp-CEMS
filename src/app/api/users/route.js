import { NextResponse } from "next/server";
import { listUsers, createUser } from "@/lib/store";
import { requireAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = requireAdmin();
  if (error) return error;
  return NextResponse.json({ users: listUsers() });
}

export async function POST(req) {
  const { error } = requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }
  if (String(body.password).length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }
  try {
    const user = createUser(body);
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    if (e.message === "EMAIL_TAKEN")
      return NextResponse.json({ error: "That email is already registered." }, { status: 409 });
    return NextResponse.json({ error: "Could not create user." }, { status: 500 });
  }
}
