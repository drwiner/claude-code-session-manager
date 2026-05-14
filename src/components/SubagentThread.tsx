"use client";

import { useEffect, useState } from "react";
import type { TurnRow } from "@/lib/queries";
import { TurnRow as TurnRowComponent } from "./TurnRow";

interface SubagentBundle {
  session_id: string;
  ai_title: string | null;
  agent_id: string | null;
  turns: TurnRow[];
}

export function SubagentThread({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SubagentBundle | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open || data) return;
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/subagent`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as SubagentBundle;
      })
      .then(setData)
      .catch((e: Error) => setErr(e.message));
  }, [open, sessionId, data]);

  return (
    <div className="mt-2 rounded border border-purple-500/30 bg-purple-500/[0.06]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-2 py-1 text-left text-[11px] font-medium text-purple-200"
      >
        <span>
          ↳ subagent transcript
          {data?.ai_title ? `: ${data.ai_title}` : ""}
          {data?.agent_id ? ` · ${data.agent_id}` : ""}
        </span>
        <span>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-purple-500/20 p-2">
          {err && <div className="text-[11px] text-red-300">load error: {err}</div>}
          {!err && !data && <div className="text-[11px] text-white/40">loading…</div>}
          {data && data.turns.length === 0 && (
            <div className="text-[11px] text-white/40">(empty subagent transcript)</div>
          )}
          {data && data.turns.length > 0 && (
            <ol className="divide-y divide-white/5 border-y border-white/5">
              {data.turns.map((t) => (
                <TurnRowComponent
                  key={t.turn_index}
                  sessionId={data.session_id}
                  turn={t}
                  sessionFirstTs={data.turns[0]?.ts ?? null}
                  forceExpanded={false}
                  subagentSessionId={null}
                />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
