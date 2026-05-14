import Link from "next/link";
import type { SessionListRow } from "@/lib/queries";
import { CopyButton } from "./CopyButton";
import { buildResumeCommand } from "@/lib/shell-escape";

function formatTs(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

function shortPath(p: string | null): string {
  if (!p) return "";
  return p.replace(/^\/Users\/[^/]+\//, "~/");
}

export function SessionRow({ s }: { s: SessionListRow }) {
  const title = s.ai_title?.trim() || s.summary?.trim() || s.first_prompt?.trim() || "(untitled)";
  const resumeCmd = buildResumeCommand(s.cwd, s.session_id);

  return (
    <li className="group flex items-center gap-3 py-1.5">
      <div className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/40">
        {formatTs(s.last_ts)}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/sessions/${encodeURIComponent(s.session_id)}`}
          className="block truncate text-sm hover:underline"
          title={title}
        >
          {title}
        </Link>
        <div className="flex items-center gap-2 text-[11px] text-white/40">
          <span className="truncate" title={s.original_path ?? ""}>
            {shortPath(s.original_path)}
          </span>
          {s.git_branch && (
            <>
              <span>·</span>
              <span className="truncate">{s.git_branch}</span>
            </>
          )}
          <span>·</span>
          <span>{s.turn_count} turns</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <CopyButton value={s.session_id} label="ID" title="Copy session ID" />
        <CopyButton value={resumeCmd} label="Resume" title={resumeCmd} />
      </div>
    </li>
  );
}
