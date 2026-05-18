import { NextResponse } from "next/server";
import { focusItermSession } from "@/lib/active-sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { itermSessionId?: string } | null;
  const id = body?.itermSessionId;
  if (!id) return NextResponse.json({ ok: false, error: "missing itermSessionId" }, { status: 400 });
  const ok = focusItermSession(id);
  return NextResponse.json({ ok });
}
