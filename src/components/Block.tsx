"use client";

import { useState } from "react";
import type { ContentBlock } from "@/lib/records";

const LARGE_THRESHOLD = 1500;

export function Block({ block }: { block: ContentBlock }) {
  switch (block.type) {
    case "text":
      return <TextBlock text={(block as { text: string }).text ?? ""} role="text" />;
    case "thinking":
      return (
        <Collapsible label="💭 thinking" defaultOpen={false} tone="muted">
          <pre className="whitespace-pre-wrap break-words text-[11px] leading-snug text-white/60">
            {(block as { thinking: string }).thinking ?? ""}
          </pre>
        </Collapsible>
      );
    case "tool_use": {
      const b = block as { name: string; input: unknown; id?: string };
      if (b.name === "Bash" && isBashInput(b.input)) {
        return <BashToolUse input={b.input} />;
      }
      const inputStr = stringify(b.input);
      const isLarge = inputStr.length > LARGE_THRESHOLD;
      return (
        <Collapsible label={`🔧 ${b.name}`} defaultOpen={!isLarge} tone="tool">
          <pre className="whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[11px] leading-snug text-emerald-200/90">
            {inputStr}
          </pre>
        </Collapsible>
      );
    }
    case "tool_result": {
      const b = block as {
        tool_use_id: string;
        content?: string | { type: string; text?: string }[];
        is_error?: boolean;
      };
      const text = renderToolResult(b.content);
      const isLarge = text.length > LARGE_THRESHOLD;
      return (
        <Collapsible
          label={b.is_error ? "✗ tool error" : "↩ tool result"}
          defaultOpen={!isLarge}
          tone={b.is_error ? "error" : "result"}
        >
          <pre className="whitespace-pre-wrap break-words rounded bg-black/40 p-2 text-[11px] leading-snug text-white/75">
            {text}
          </pre>
        </Collapsible>
      );
    }
    case "image":
      return (
        <div className="text-[11px] italic text-white/40">[image attachment]</div>
      );
    default: {
      const b = block as { type: string };
      return (
        <Collapsible label={`(${b.type})`} defaultOpen={false} tone="muted">
          <pre className="whitespace-pre-wrap break-words text-[11px] text-white/60">
            {stringify(block)}
          </pre>
        </Collapsible>
      );
    }
  }
}

type BashInput = {
  command: string;
  description?: string;
  run_in_background?: boolean;
  timeout?: number;
};

function isBashInput(v: unknown): v is BashInput {
  return (
    !!v &&
    typeof v === "object" &&
    typeof (v as { command?: unknown }).command === "string"
  );
}

function BashToolUse({ input }: { input: BashInput }) {
  const { command, description, run_in_background, timeout } = input;
  const isLarge = command.length > LARGE_THRESHOLD;
  const label = description ? `🖥 Bash · ${description}` : "🖥 Bash";
  return (
    <Collapsible label={label} defaultOpen={!isLarge} tone="tool">
      <div className="rounded bg-black/70 p-2 font-mono text-[11px] leading-snug ring-1 ring-emerald-500/20">
        <pre className="whitespace-pre-wrap break-words text-emerald-300">
          <span className="select-none text-emerald-500/70">$ </span>
          <span className="text-emerald-100">{command}</span>
        </pre>
        {(run_in_background || typeof timeout === "number") && (
          <div className="mt-1 text-[10px] text-white/40">
            {run_in_background ? "background · " : ""}
            {typeof timeout === "number" ? `timeout ${timeout}ms` : ""}
          </div>
        )}
      </div>
    </Collapsible>
  );
}

function TextBlock({ text }: { text: string; role: string }) {
  const isLarge = text.length > LARGE_THRESHOLD;
  if (!isLarge) {
    return (
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
        {text}
      </div>
    );
  }
  return (
    <Collapsible
      label={`text · ${text.length.toLocaleString()} chars`}
      defaultOpen={false}
      tone="text"
    >
      <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-white/85">
        {text}
      </div>
    </Collapsible>
  );
}

function Collapsible({
  label,
  defaultOpen,
  tone,
  children,
}: {
  label: string;
  defaultOpen: boolean;
  tone: "muted" | "tool" | "result" | "error" | "text";
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toneClass: Record<typeof tone, string> = {
    muted: "border-white/10 text-white/50",
    tool: "border-emerald-500/30 text-emerald-200",
    result: "border-white/15 text-white/70",
    error: "border-red-500/40 text-red-200",
    text: "border-white/15 text-white/70",
  };
  return (
    <div className={`rounded border ${toneClass[tone]} bg-white/[0.02]`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] font-medium"
      >
        <span>{label}</span>
        <span className="text-white/40">{open ? "▾" : "▸"}</span>
      </button>
      {open && <div className="border-t border-white/10 p-2">{children}</div>}
    </div>
  );
}

function stringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function renderToolResult(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (typeof c === "string") return c;
        if (c && typeof c === "object" && "text" in c && typeof (c as { text: unknown }).text === "string") {
          return (c as { text: string }).text;
        }
        return stringify(c);
      })
      .join("\n");
  }
  return stringify(content);
}
