/**
 * Claude Code encodes the project's absolute path by replacing every "/" with
 * "-". This is ambiguous because real path segments can contain "-" too
 * (e.g. /Users/drw/cerbrec/reveel-pdf → -Users-drw-cerbrec-reveel-pdf).
 *
 * This heuristic decode is only a fallback. The authoritative source is
 * `sessions-index.json#originalPath` or the `cwd` field on any session
 * record — the indexer always prefers those.
 */
export function decodeProjectFolderHeuristic(folderName: string): string {
  if (!folderName.startsWith("-")) return folderName;
  return "/" + folderName.slice(1).replaceAll("-", "/");
}
