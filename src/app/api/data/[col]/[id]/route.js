import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { isAllowed, getOne, updateOne, removeOne, ADMIN_WRITE } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guard(col, user, write) {
  if (!isAllowed(col)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
  if (write && ADMIN_WRITE.has(col) && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });
  return null;
}

export async function GET(_req, { params }) {
  const { error, user } = await requireUser();
  if (error) return error;
  const g = guard(params.col, user, false);
  if (g) return g;
  try {
    const doc = await getOne(params.col, params.id);
    return NextResponse.json({ doc });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to load." }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { error, user } = await requireUser();
  if (error) return error;
  const g = guard(params.col, user, true);
  if (g) return g;
  try {
    const data = await req.json().catch(() => ({}));
    await updateOne(params.col, params.id, data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to update." }, { status: 500 });
  }
}

export async function DELETE(_req, { params }) {
  const { error, user } = await requireUser();
  if (error) return error;
  const g = guard(params.col, user, true);
  if (g) return g;
  try {
    await removeOne(params.col, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to delete." }, { status: 500 });
  }
}
