import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSession, listTurns } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const sessionId = decodeURIComponent(id);
  const s = getSession(sessionId);
  if (!s) return NextResponse.json({ error: "subagent session not found" }, { status: 404 });
  const agentIdRow = getDb()
    .prepare("SELECT agent_id FROM sessions WHERE session_id = ?")
    .get(sessionId) as { agent_id: string | null } | undefined;
  const turns = listTurns(sessionId);
  return NextResponse.json({
    session_id: sessionId,
    ai_title: s.ai_title,
    agent_id: agentIdRow?.agent_id ?? null,
    turns,
  });
}
