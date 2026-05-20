"use client";

import { useEffect, useState } from "react";
import type { TurnRow as TurnRowType } from "@/lib/queries";
import { TurnDetail } from "./TurnDetail";
import { SubagentThread } from "./SubagentThread";

function formatDelta(ts: string | null, baseTs: string | null): string {
  if (!ts || !baseTs) return "";
  const ms = new Date(ts).getTime() - new Date(baseTs).getTime();
  if (Number.isNaN(ms)) return "";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `+${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `+${m}m`;
  const h = Math.floor(m / 60);
  return `+${h}h${m % 60}m`;
}

export function TurnRow({
  sessionId,
  turn,
  sessionFirstTs,
  forceExpanded,
  subagentSessionId,
}: {
  sessionId: string;
  turn: TurnRowType;
  sessionFirstTs: string | null;
  forceExpanded: boolean;
  subagentSessionId: string | null;
}) {
  const [open, setOpen] = useState(forceExpanded);

  useEffect(() => {
    setOpen(forceExpanded);
  }, [forceExpanded]);

  // Auto-expand and scroll to this turn when the URL hash targets it
  // (used by search "turn N" links from the session list).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = `turn-${turn.turn_index}`;
    const matches = () => window.location.hash === `#${target}`;
    if (matches()) {
      setOpen(true);
      requestAnimationFrame(() => {
        document.getElementById(target)?.scrollIntoView({ block: "start" });
      });
    }
    const onHashChange = () => {
      if (matches()) {
        setOpen(true);
        requestAnimationFrame(() => {
          document.getElementById(target)?.scrollIntoView({ block: "start" });
        });
      }
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [turn.turn_index]);

  const tools: string[] = turn.tool_names ? (JSON.parse(turn.tool_names) as string[]) : [];
  const uniqueTools = Array.from(new Set(tools));
  const isUser = turn.role === "user";
  const roleColor = isUser
    ? "bg-amber-500/15 text-amber-200 border-amber-500/30"
    : "bg-sky-500/15 text-sky-200 border-sky-500/30";

  return (
    <li id={`turn-${turn.turn_index}`} className="scroll-mt-4 px-1">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-1.5 text-left hover:bg-white/[0.02]"
      >
        <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-white/40">
          #{turn.turn_index}
        </span>
        <span
          className={`shrink-0 rounded border px-1.5 py-px text-[10px] font-medium uppercase tracking-wide ${roleColor}`}
        >
          {turn.role}
        </span>
        <span className="w-12 shrink-0 text-[10px] tabular-nums text-white/40">
          {formatDelta(turn.ts, sessionFirstTs)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-white/80">
          {turn.summary || "(empty)"}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] text-white/40">
          {turn.has_thinking === 1 && <span title="includes thinking">💭</span>}
          {uniqueTools.slice(0, 4).map((n) => (
            <span
              key={n}
              className="rounded bg-white/[0.04] px-1 py-px text-[9px] uppercase tracking-wide"
            >
              {n}
            </span>
          ))}
          {uniqueTools.length > 4 && <span>+{uniqueTools.length - 4}</span>}
          {subagentSessionId && (
            <span className="rounded border border-purple-500/40 bg-purple-500/15 px-1 py-px text-[9px] uppercase tracking-wide text-purple-200">
              subagent
            </span>
          )}
          <span className="w-3 text-center text-white/30">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <div className="ml-10 border-l border-white/10 pl-3 pb-3">
          <TurnDetail sessionId={sessionId} turnIndex={turn.turn_index} />
          {subagentSessionId && <SubagentThread sessionId={subagentSessionId} />}
        </div>
      )}
    </li>
  );
}
