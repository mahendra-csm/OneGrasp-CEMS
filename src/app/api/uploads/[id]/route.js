import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { deleteUploadSet } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cascade-delete an upload set: removes the set doc + all its contacts.
export async function DELETE(_req, { params }) {
  const { error } = await requireUser();
  if (error) return error;
  try {
    const result = await deleteUploadSet(params.id);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Failed to delete set." }, { status: 500 });
  }
}
