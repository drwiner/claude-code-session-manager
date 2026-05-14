"use client";

import { useState } from "react";

export function CopyButton({
  value,
  label,
  title,
  variant = "ghost",
}: {
  value: string;
  label: string;
  title?: string;
  variant?: "ghost" | "primary";
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  }

  const base =
    "rounded border px-2 py-0.5 text-[11px] font-medium transition active:scale-95";
  const styles =
    variant === "primary"
      ? "border-amber-500/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25"
      : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white";

  return (
    <button onClick={copy} title={title ?? value} className={`${base} ${styles}`}>
      {copied ? "✓ copied" : label}
    </button>
  );
}
