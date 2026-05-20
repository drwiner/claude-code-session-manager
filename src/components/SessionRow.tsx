import Link from "next/link";
import {
  SEARCH_HIGHLIGHT_END,
  SEARCH_HIGHLIGHT_START,
  type SessionListRow,
} from "@/lib/queries";
import { CopyButton } from "./CopyButton";
import { RevealInItermButton } from "./RevealInItermButton";
import { buildCodexResumeCommand, buildResumeCommand } from "@/lib/shell-escape";

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderSnippetHtml(snippet: string): string {
  const escaped = escapeHtml(snippet);
  return escaped
    .split(SEARCH_HIGHLIGHT_START)
    .join('<mark class="rounded-sm bg-amber-300/30 px-0.5 text-amber-100">')
    .split(SEARCH_HIGHLIGHT_END)
    .join("</mark>");
}

export function SessionRow({
  s,
  activeStatus,
  itermSessionId,
  tty,
}: {
  s: SessionListRow;
  activeStatus?: string | null;
  itermSessionId?: string | null;
  tty?: string | null;
}) {
  const title = s.ai_title?.trim() || s.summary?.trim() || s.first_prompt?.trim() || "(untitled)";
  const isCodex = s.source === "codex";
  const resumeCmd = isCodex
    ? buildCodexResumeCommand(s.cwd, s.session_id)
    : buildResumeCommand(s.cwd, s.session_id);

  const statusColor =
    activeStatus === "busy"
      ? "bg-emerald-400"
      : activeStatus
      ? "bg-sky-400"
      : null;

  return (
    <li className="group flex items-center gap-3 py-1.5">
      <div
        className="w-16 shrink-0 text-right text-[11px] tabular-nums text-white/40"
        title={s.last_user_ts ? `last user input ${new Date(s.last_user_ts).toLocaleString()}` : ""}
      >
        {formatTs(s.last_user_ts ?? s.last_ts)}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/sessions/${encodeURIComponent(s.session_id)}`}
          className="block truncate text-sm hover:underline"
          title={title}
        >
          {statusColor && (
            <span
              className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${statusColor}`}
              title={activeStatus ?? undefined}
            />
          )}
          {isCodex && (
            <span
              className="mr-1.5 rounded border border-purple-400/30 bg-purple-400/10 px-1 py-px text-[9px] uppercase tracking-wider text-purple-300 align-middle"
              title="Codex session"
            >
              codex
            </span>
          )}
          {title}
        </Link>
        {s.match_snippet && (
          <Link
            href={
              s.match_turn_index != null
                ? `/sessions/${encodeURIComponent(s.session_id)}#turn-${s.match_turn_index}`
                : `/sessions/${encodeURIComponent(s.session_id)}`
            }
            className="mt-0.5 block truncate text-[11px] text-white/60 hover:text-white"
            title="Jump to matching turn"
          >
            {s.match_turn_index != null && (
              <span className="mr-1.5 rounded border border-amber-300/30 bg-amber-300/10 px-1 py-px text-[9px] uppercase tracking-wider text-amber-200 align-middle">
                turn {s.match_turn_index}
              </span>
            )}
            <span
              className="align-middle"
              dangerouslySetInnerHTML={{ __html: renderSnippetHtml(s.match_snippet) }}
            />
          </Link>
        )}
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
      <div className="flex shrink-0 items-center gap-1">
        {itermSessionId && (
          <RevealInItermButton
            itermSessionId={itermSessionId}
            title={tty ? `Reveal iTerm session (${tty})` : "Reveal in iTerm"}
          />
        )}
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <CopyButton value={s.session_id} label="ID" title="Copy session ID" />
          <CopyButton value={resumeCmd} label="Resume" title={resumeCmd} />
        </div>
      </div>
    </li>
  );
}
