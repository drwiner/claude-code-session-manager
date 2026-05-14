import { NextResponse } from "next/server";
import { runIndexer } from "@/lib/indexer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const stats = await runIndexer();
  return NextResponse.json(stats);
}
