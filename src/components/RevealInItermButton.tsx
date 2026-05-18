"use client";

import { useState } from "react";

export function RevealInItermButton({
  itermSessionId,
  title,
}: {
  itermSessionId: string;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "pending" | "ok" | "err">("idle");

  async function reveal(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setState("pending");
    try {
      const r = await fetch("/api/active-sessions/focus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ itermSessionId }),
      });
      const { ok } = (await r.json()) as { ok?: boolean };
      setState(ok ? "ok" : "err");
    } catch {
      setState("err");
    }
    setTimeout(() => setState("idle"), 1200);
  }

  const label =
    state === "pending" ? "…" : state === "ok" ? "✓" : state === "err" ? "✗" : "↗ iTerm";

  return (
    <button
      onClick={reveal}
      title={title ?? "Reveal in iTerm"}
      className="rounded border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-400/20 active:scale-95"
    >
      {label}
    </button>
  );
}
