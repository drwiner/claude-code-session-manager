# Claude Session Browser

A local Next.js app for browsing, searching, and managing your Claude Code (and Codex) sessions. It indexes the JSONL transcripts that Claude Code writes to `~/.claude/projects` and exposes them through a fast, searchable web UI.

## What it does

- **Indexes sessions** from `~/.claude/projects` and `~/.codex/sessions` into a local SQLite database (`data/index.db`).
- **Browses projects and sessions** with full-text search over prompts and project paths.
- **Shows live sessions** by reading `~/.claude/sessions` activity heartbeats.
- **Drills into turns** — view individual turns, tool calls, and subagent threads.
- **Reveal in iTerm** — jump from a session row back to the terminal where it's running.
- **Reindex on demand** via a UI button or `pnpm reindex`.

Indexing runs automatically on dev/server boot (see `src/instrumentation.ts`) and is incremental — unchanged files are skipped via mtime.

## Requirements

- Node.js 20+
- pnpm 9+
- macOS (paths assume `~/.claude` and `~/.codex`; iTerm integration is mac-only)

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. The first boot triggers a full index; subsequent boots only pick up changed files.

## Scripts

- `pnpm dev` — Next.js dev server (Turbopack); kicks off the indexer on boot.
- `pnpm build` / `pnpm start` — production build / serve.
- `pnpm reindex` — run the indexer once from the CLI.
- `pnpm lint` — Next.js lint.

## Layout

```
src/
  app/                   Next.js app router pages + API routes
    api/reindex          POST to trigger a reindex
    api/sessions/[id]    Turn and subagent endpoints
    api/active-sessions  Focus/reveal endpoints
    sessions/[id]        Session detail page
  components/            React UI (SessionRow, TurnDetail, SearchBar, ...)
  lib/
    db.ts                better-sqlite3 connection + meta table
    indexer.ts           Walks projects, dispatches per-source parsers
    parse-session.ts     Claude Code JSONL parser
    parse-codex-session.ts  Codex JSONL parser
    queries.ts           Read-side queries for the UI
    active-sessions.ts   Reads ~/.claude/sessions heartbeats
    paths.ts             Source directories
data/index.db            SQLite index (gitignored)
```

## Data sources

| Path | Purpose |
| --- | --- |
| `~/.claude/projects/*/` | Claude Code session JSONL files |
| `~/.claude/sessions/` | Active session heartbeats (status, tty, iTerm session id) |
| `~/.codex/sessions/` | Codex session JSONL files |

Nothing is written back to these directories — the app is read-only against your transcripts.

## Notes

- The SQLite file lives at `data/index.db` relative to the working directory and is gitignored.
- The indexer is in-process and guarded by a single in-flight promise (`runIndexer` in `src/lib/indexer.ts`), so concurrent triggers coalesce.
