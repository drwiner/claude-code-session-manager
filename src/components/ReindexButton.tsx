"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function ReindexButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<string | null>(null);

  async function go() {
    setRunning(true);
    try {
      const res = await fetch("/api/reindex", { method: "POST" });
      const data = (await res.json()) as { sessionsChanged?: number; durationMs?: number };
      setLast(`+${data.sessionsChanged ?? 0} in ${data.durationMs ?? 0}ms`);
      start(() => router.refresh());
    } catch (err) {
      setLast(`error: ${(err as Error).message}`);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {last && <span className="text-[11px] text-white/40">{last}</span>}
      <button
        onClick={go}
        disabled={running || pending}
        className="rounded border border-white/10 bg-white/[0.03] px-3 py-1 text-xs hover:border-white/30 hover:text-white disabled:opacity-50"
      >
        {running ? "Reindexing…" : "Reindex"}
      </button>
    </div>
  );
}
