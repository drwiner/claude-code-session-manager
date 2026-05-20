import { NextResponse } from "next/server";
import { getSession, getTurnRef } from "@/lib/queries";
import { loadTurnDetail } from "@/lib/parse-session";
import { loadCodexTurnDetail } from "@/lib/parse-codex-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; idx: string }> },
) {
  const { id, idx } = await ctx.params;
  const sessionId = decodeURIComponent(id);
  const turnIndex = Number(idx);
  if (!Number.isInteger(turnIndex)) {
    return NextResponse.json({ error: "bad turn index" }, { status: 400 });
  }
  const s = getSession(sessionId);
  if (!s) return NextResponse.json({ error: "session not found" }, { status: 404 });
  const ref = getTurnRef(sessionId, turnIndex);
  if (!ref) return NextResponse.json({ error: "turn not found" }, { status: 404 });
  const detail =
    s.source === "codex"
      ? await loadCodexTurnDetail(s.file_path, ref)
      : await loadTurnDetail(s.file_path, ref);
  return NextResponse.json(detail);
}
