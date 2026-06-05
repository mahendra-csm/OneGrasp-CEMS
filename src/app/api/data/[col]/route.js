import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { isAllowed, listDocs, createDoc, ADMIN_WRITE } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  const { error, user } = await requireUser();
  if (error) return error;
  if (!isAllowed(params.col)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
  try {
    const limit = req.nextUrl.searchParams.get("limit");
    const docs = await listDocs(params.col, { limit: limit ? Number(limit) : undefined });
    return NextResponse.json({ docs });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to load data." }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const { error, user } = await requireUser();
  if (error) return error;
  if (!isAllowed(params.col)) return NextResponse.json({ error: "Unknown collection." }, { status: 404 });
  if (ADMIN_WRITE.has(params.col) && user.role !== "admin")
    return NextResponse.json({ error: "Forbidden — admins only" }, { status: 403 });
  try {
    const data = await req.json().catch(() => ({}));
    const id = await createDoc(params.col, data);
    return NextResponse.json({ id }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to create." }, { status: 500 });
  }
}
