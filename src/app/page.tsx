import Link from "next/link";
import { listProjects, listSessions, searchProjects, totalSessionCount } from "@/lib/queries";
import { getMeta } from "@/lib/db";
import { SearchBar } from "@/components/SearchBar";
import { SessionRow } from "@/components/SessionRow";
import { ReindexButton } from "@/components/ReindexButton";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ q?: string; project?: string; sub?: string; limit?: string }>;
}

const LIMIT_CHOICES = [10, 20, 50, 100, 300] as const;
const DEFAULT_LIMIT = 300;

function parseLimit(raw: string | undefined): number {
  if (!raw) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(1000, Math.floor(n)));
}

export default async function Home({ searchParams }: Props) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const projectId = sp.project?.trim() || undefined;
  const includeSidechain = sp.sub === "1";
  const limit = parseLimit(sp.limit);

  const sessions = listSessions({
    search: q || undefined,
    projectId,
    includeSidechain,
    limit,
  });
  const total = totalSessionCount();
  const projects = listProjects();
  const matchedProjects = q ? searchProjects(q) : [];
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
                ...(limit !== DEFAULT_LIMIT ? { limit: String(limit) } : {}),
              }).toString()}`}
              className="inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[11px] text-white/70 hover:border-white/30 hover:text-white"
            >
              <span className={includeSidechain ? "text-amber-300" : "text-white/40"}>●</span>
              Include subagents
            </Link>
          </div>
          <div className="mt-3">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
              Show last
            </div>
            <div className="flex flex-wrap gap-1">
              {LIMIT_CHOICES.map((n) => {
                const active = n === limit;
                const label = n === DEFAULT_LIMIT ? "All" : String(n);
                const params = new URLSearchParams({
                  ...(q ? { q } : {}),
                  ...(projectId ? { project: projectId } : {}),
                  ...(includeSidechain ? { sub: "1" } : {}),
                  ...(n !== DEFAULT_LIMIT ? { limit: String(n) } : {}),
                });
                const href = `/${params.toString() ? `?${params.toString()}` : ""}`;
                return (
                  <Link
                    key={n}
                    href={href}
                    className={
                      "rounded border px-2 py-1 text-[11px] " +
                      (active
                        ? "border-white/40 bg-white/10 text-white"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/30 hover:text-white")
                    }
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
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
          {q && matchedProjects.length > 0 && (
            <div className="mb-4 rounded border border-white/10 bg-white/[0.02] p-3">
              <div className="mb-1 text-[10px] uppercase tracking-wider text-white/40">
                Projects matching “{q}”
              </div>
              <ul className="space-y-px text-sm">
                {matchedProjects.map((p) => {
                  const params = new URLSearchParams({
                    project: p.project_id,
                    ...(includeSidechain ? { sub: "1" } : {}),
                    ...(limit !== DEFAULT_LIMIT ? { limit: String(limit) } : {}),
                  });
                  return (
                    <li key={p.project_id} className="flex items-baseline justify-between gap-3">
                      <Link
                        href={`/?${params.toString()}`}
                        className="truncate text-white/80 hover:underline"
                        title={p.original_path}
                      >
                        {p.original_path.replace(/^\/Users\/[^/]+\//, "~/")}
                      </Link>
                      <span className="shrink-0 text-[11px] text-white/40">
                        {p.session_count} session{p.session_count === 1 ? "" : "s"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
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
