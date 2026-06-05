import { NextResponse } from "next/server";
import { requireUser } from "@/lib/server-auth";
import { importUploadSet } from "@/lib/data-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Email-only "set" import. Body: { name, date (YYYY-MM-DD), emails: string[] }.
export async function POST(req) {
  const { error } = requireUser();
  if (error) return error;
  try {
    const { name, date, emails } = await req.json().catch(() => ({}));
    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: "No emails found in the uploaded file." }, { status: 400 });
    }
    const result = await importUploadSet({ name, date, emails });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message || "Set upload failed." }, { status: 500 });
  }
}
