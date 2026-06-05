import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { bulkInsertContacts } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  const { error } = requireUser();
  if (error) return error;
  try {
    const { rows } = await req.json().catch(() => ({ rows: [] }));
    const result = await bulkInsertContacts(rows || []);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Bulk import failed." }, { status: 500 });
  }
}
