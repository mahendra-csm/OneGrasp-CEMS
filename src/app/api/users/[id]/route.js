import { NextResponse } from "next/server";
import { updateUser, deleteUser } from "@/lib/store";
import { requireAdmin } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  const { error } = requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => ({}));
  try {
    const user = updateUser(params.id, body);
    return NextResponse.json({ user });
  } catch (e) {
    if (e.message === "NOT_FOUND")
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (e.message === "LAST_ADMIN")
      return NextResponse.json({ error: "There must be at least one enabled admin." }, { status: 400 });
    return NextResponse.json({ error: "Could not update user." }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { error, user } = requireAdmin();
  if (error) return error;
  if (user.id === params.id) {
    return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
  }
  try {
    deleteUser(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e.message === "NOT_FOUND")
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (e.message === "LAST_ADMIN")
      return NextResponse.json({ error: "Cannot delete the last admin." }, { status: 400 });
    return NextResponse.json({ error: "Could not delete user." }, { status: 500 });
  }
}
