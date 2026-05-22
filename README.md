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

## Multi-machine sync with Syncthing

You can use [Syncthing](https://syncthing.net) to mirror your session transcripts between machines so this app shows one merged history regardless of which Mac you're on. The app surfaces the originating host (the machine where a session was actually run) and the git HEAD that was checked out at the time, giving you enough context to resume from a different machine.

### One-time setup

1. Install Syncthing on every machine you want in the mesh:

   ```bash
   brew install syncthing
   brew services start syncthing
   ```

2. Open `http://127.0.0.1:8384` on each machine — Syncthing's web UI. Each machine has a unique **Device ID** at the top.

3. On each machine, **Add Remote Device** and paste in the other machine's Device ID. Accept the pairing prompt on the other side. (For a small home setup, pair every machine with one always-on box and use that as the hub.)

4. On one machine, **Add Folder** for each path below and share it with the other devices. Each other machine then sees a "new folder" prompt and picks the same local path on its side. **All machines must use the same absolute paths** (e.g., same macOS username) for session resume to work — see "Resuming sessions" below.

   Folders to sync:

   | Folder ID | Local path |
   | --- | --- |
   | `claude-projects` | `~/.claude/projects` |
   | `codex-sessions`  | `~/.codex/sessions` |

5. For each folder, set **Folder Type** to `Send & Receive` on every machine (true multi-master). Syncthing handles the conflict-free case automatically because session JSONL filenames are per-host UUIDs.

### What NOT to sync

| Path | Why |
| --- | --- |
| `~/.claude/auth.json` | Credentials. Each machine should authenticate itself. |
| `~/.claude/sessions/` | PID-keyed heartbeat files for live Claude Code processes. Syncing them produces phantom "active" sessions whose PIDs belong to other machines. |
| `~/.codex/auth.json`, `~/.codex/logs_*.sqlite*`, `~/.codex/history.jsonl` | Credentials / SQLite hot files (corruption risk) / single-writer history file (sync conflicts on every append). |

In Syncthing, you can either add only the specific subfolders above (recommended) or add the whole `~/.claude` / `~/.codex` dir and exclude the rest via `.stignore`.

### Resuming sessions across machines

Once a session JSONL is on the second machine, you can run `claude --resume <session-id>` and it works **only if**:

- **The macOS username matches** on both machines (so `~/.claude/projects/<encoded-cwd>/` resolves the same path). If usernames differ, symlink `/Users/<other> → /Users/<this>` on one of them.
- **The project is checked out at the same absolute path** as the originating machine's `cwd`. The session row in the UI shows the `cwd` it expects.
- **The repo is at (or near) the same commit** as when the session ran. The session row shows `@<sha7>` — that's the HEAD this app captured. A `*` after the sha means the tree was dirty when the snapshot was taken (some changes won't reproduce exactly). Run `git checkout <sha>` in the cwd to land on the same point before resuming.

### How attribution works under the hood

When the indexer processes a session JSONL it writes two sidecar files next to it, which Syncthing distributes alongside the transcript:

- `<session>.jsonl.host.json` — `{ hostname, claimedAt }` for the machine that first claimed this session.
- `<session>.jsonl.git.json` — array of `{ cwd, branch, head, dirty, capturedAt }` snapshots per cwd touched by the session.

The host badge in the UI compares the sidecar's `hostname` against the local machine's hostname and dims it for local-origin rows.

> **Caveat (current state):** The first-claim heuristic uses filesystem birthtime vs. mtime to guess whether a JSONL was authored locally or imported by Syncthing. It's reliable for transcripts synced in long after they were written, but mislabels sessions that Syncthing distributed shortly after the originating machine wrote them. If you see wrong hostnames, the upcoming `claim-here` CLI (planned) will let you manually re-attribute on the correct machine.

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

The transcripts themselves are read-only. The app writes two small sidecar files next to each JSONL: `<session>.jsonl.host.json` (originating host) and `<session>.jsonl.git.json` (per-cwd HEAD snapshots). These are designed to travel through Syncthing — see "Multi-machine sync with Syncthing" above.

## Notes

- The SQLite file lives at `data/index.db` relative to the working directory and is gitignored.
- The indexer is in-process and guarded by a single in-flight promise (`runIndexer` in `src/lib/indexer.ts`), so concurrent triggers coalesce.
