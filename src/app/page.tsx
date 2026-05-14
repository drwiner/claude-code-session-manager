import Link from "next/link";
import { listProjects, listSessions, totalSessionCount } from "@/lib/queries";
import { getMeta } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { SessionRow } from "@/components/SessionRow";
import { ReindexButton } from "@/components/ReindexButton";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; project?: string; sub?: string }>;
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const projectId = sp.project?.trim() || undefined;
  const includeSidechain = sp.sub === "1";

  const sessions = listSessions({
    search: q || undefined,
    projectId,
    includeSidechain,
    limit: 300,
  });
  const total = totalSessionCount();
  const projects = listProjects();
  const lastIndexed = getMeta("last_indexed_at");

  return (
    <main className="mx-auto max-w-7xl px-6 py-6">
      <header className="flex flex-wrap items-baseline justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Claude Sessions</h1>
          <p className="text-xs text-white/50">
            {total.toLocaleString()} sessions · {projects.length} projects
            {lastIndexed && (
              <>
                {" · "}indexed {new Date(Number(lastIndexed)).toLocaleString()}
              </>
            )}
          </p>
        </div>
        <ReindexButton />
      </header>

      <div className="mt-4 flex gap-6">
        <aside className="w-64 shrink-0">
          <SearchBar initial={q} />
          <div className="mt-2">
            <Link
              href={`/?${new URLSearchParams({
                ...(q ? { q } : {}),
                ...(projectId ? { project: projectId } : {}),
                ...(includeSidechain ? {} : { sub: "1" }),
              }).toString()}`}
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70 hover:border-white/30 hover:text-white"
            >
              <span className={includeSidechain ? "text-amber-300" : "text-white/40"}>●</span>
              Include subagents
            </Link>
          </div>
          <nav className="mt-4">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">Projects</div>
            <ul className="space-y-px text-sm">
              <li>
                <Link
                  href={q ? `/?q=${encodeURIComponent(q)}` : "/"}
                  className={
                    "block truncate rounded px-2 py-1 hover:bg-white/5 " +
                    (!projectId ? "bg-white/10 text-white" : "text-white/70")
                  }
                >
                  All projects ({total})
                </Link>
              </li>
              {projects.map((p) => (
                <li key={p.project_id}>
                  <Link
                    href={`/?project=${encodeURIComponent(p.project_id)}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                    className={
                      "block truncate rounded px-2 py-1 hover:bg-white/5 " +
                      (projectId === p.project_id ? "bg-white/10 text-white" : "text-white/70")
                    }
                    title={p.original_path}
                  >
                    {p.original_path.replace(/^\/Users\/[^/]+\//, "~/")}
                    <span className="ml-1 text-white/40">({p.session_count})</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <section className="min-w-0 flex-1">
          {sessions.length === 0 ? (
            <div className="rounded border border-dashed border-white/10 p-8 text-center text-sm text-white/50">
              {q || projectId ? (
                <>No sessions match. Try a different search.</>
              ) : (
                <>No sessions indexed yet. Indexing runs on dev start — refresh in a moment.</>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {sessions.map((s) => (
                <SessionRow key={s.session_id} s={s} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
