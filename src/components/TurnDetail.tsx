"use client";

import { useEffect, useState } from "react";
import type { TurnDetail as TurnDetailType } from "@/lib/types";
import { Block } from "./Block";

export function TurnDetail({
  sessionId,
  turnIndex,
}: {
  sessionId: string;
  turnIndex: number;
}) {
  const [data, setData] = useState<TurnDetailType | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/turn/${turnIndex}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as TurnDetailType;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, turnIndex]);

  if (err) return <div className="py-2 text-xs text-red-300">load error: {err}</div>;
  if (!data)
    return <div className="py-2 text-xs text-white/40">loading…</div>;

  return (
    <div className="space-y-2 py-2">
      {data.blocks.length === 0 && (
        <div className="text-xs text-white/40">(no content)</div>
      )}
      {data.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      {data.inlineMarkers.length > 0 && (
        <details className="rounded bg-white/[0.02] px-2 py-1">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-white/40">
            {data.inlineMarkers.length} housekeeping records
          </summary>
          <ul className="mt-1 space-y-0.5 text-[11px] text-white/50">
            {data.inlineMarkers.map((m, i) => (
              <li key={i}>
                <span className="text-white/30">{m.type}</span>
                {m.subtype && <span className="text-white/30">/{m.subtype}</span>}
                {m.note && <span className="ml-2 text-white/60">{m.note}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
