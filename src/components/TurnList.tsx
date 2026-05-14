"use client";

import { useMemo, useState } from "react";
import type { TurnRow } from "@/lib/queries";
import { TurnRow as TurnRowComponent } from "./TurnRow";

export function TurnList({
  sessionId,
  turns,
  subagentSessionIds,
}: {
  sessionId: string;
  turns: TurnRow[];
  subagentSessionIds: string[];
}) {
  const [filter, setFilter] = useState("");
  const [expandAll, setExpandAll] = useState(false);

  const filtered = useMemo(() => {
    if (!filter.trim()) return turns;
    const q = filter.toLowerCase();
    return turns.filter((t) => (t.summary ?? "").toLowerCase().includes(q));
  }, [filter, turns]);

  // Subagents are matched to turns by spawn order: the Nth turn that
  // uses the Agent/Task tool maps to the Nth subagent in session order.
  const subagentByAgentTurn = useMemo(() => {
    const out = new Map<number, string>();
    let nextIdx = 0;
    for (const t of turns) {
      const tools = t.tool_names ? (JSON.parse(t.tool_names) as string[]) : [];
      const spawnsAgent = tools.some((n) => n === "Agent" || n === "Task");
      if (spawnsAgent && nextIdx < subagentSessionIds.length) {
        out.set(t.turn_index, subagentSessionIds[nextIdx]);
        nextIdx += 1;
      }
    }
    return out;
  }, [turns, subagentSessionIds]);

  const firstTs = turns[0]?.ts;

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Filter ${turns.length} turns…`}
          className="flex-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-xs outline-none focus:border-white/30"
        />
        <button
          onClick={() => setExpandAll((v) => !v)}
          className="rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] hover:border-white/30"
        >
          {expandAll ? "Collapse all" : "Expand all"}
        </button>
      </div>
      <ol className="divide-y divide-white/5 border-y border-white/5">
        {filtered.map((t) => (
          <TurnRowComponent
            key={t.turn_index}
            sessionId={sessionId}
            turn={t}
            sessionFirstTs={firstTs ?? null}
            forceExpanded={expandAll}
            subagentSessionId={subagentByAgentTurn.get(t.turn_index) ?? null}
          />
        ))}
      </ol>
      {filtered.length === 0 && (
        <div className="py-6 text-center text-xs text-white/40">No turns match.</div>
      )}
    </div>
  );
}
