import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession, listSubagentsFor, listTurns } from "@/lib/queries";
import { buildCodexResumeCommand, buildResumeCommand } from "@/lib/shell-escape";
import { CopyButton } from "@/components/CopyButton";
import { TurnList } from "@/components/TurnList";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionPage({ params }: Props) {
  const { id } = await params;
  const sessionId = decodeURIComponent(id);
  const s = getSession(sessionId);
  if (!s) notFound();

  const turns = listTurns(sessionId);
  const subagents = listSubagentsFor(sessionId);
  const isCodex = s.source === "codex";
  const resumeCmd = isCodex
    ? buildCodexResumeCommand(s.cwd, s.session_id)
    : buildResumeCommand(s.cwd, s.session_id);

  const title = s.ai_title?.trim() || s.summary?.trim() || s.first_prompt?.trim() || "(untitled)";

  return (
    <main className="mx-auto max-w-5xl px-6 py-6">
      <Link
        href="/"
        className="text-[11px] text-white/40 hover:text-white/70"
      >
        ← All sessions
      </Link>
      <header className="mt-2 border-b border-white/10 pb-4">
        <h1 className="flex items-center gap-2 text-lg font-semibold leading-tight">
          {isCodex && (
            <span
              className="rounded border border-purple-400/30 bg-purple-400/10 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-purple-300"
              title="Codex session"
            >
              codex
            </span>
          )}
          <span>{title}</span>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          <span>
            <span className="text-white/30">id </span>
            <code className="text-white/70">{s.session_id}</code>
          </span>
          {s.original_path && (
            <span title={s.original_path}>
              <span className="text-white/30">project </span>
              {s.original_path}
            </span>
          )}
          {s.git_branch && (
            <span>
              <span className="text-white/30">branch </span>
              {s.git_branch}
            </span>
          )}
          {s.model && (
            <span>
              <span className="text-white/30">model </span>
              {s.model}
            </span>
          )}
          <span>
            <span className="text-white/30">turns </span>
            {s.turn_count}
          </span>
          {s.last_ts && (
            <span>
              <span className="text-white/30">last </span>
              {new Date(s.last_ts).toLocaleString()}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <CopyButton value={s.session_id} label="Copy ID" />
          <CopyButton value={resumeCmd} label="Copy resume command" variant="primary" title={resumeCmd} />
          <code className="truncate rounded bg-white/[0.04] px-2 py-1 text-[11px] text-white/60">
            {resumeCmd}
          </code>
        </div>
      </header>

      <TurnList sessionId={sessionId} turns={turns} subagentSessionIds={subagents.map((s) => s.session_id)} />
    </main>
  );
}
