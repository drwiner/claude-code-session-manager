export async function register() {
  // Only run on the node runtime (skip edge).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Only run once per process — Next can call register multiple times in dev.
  const g = globalThis as unknown as { __indexerKicked?: boolean };
  if (g.__indexerKicked) return;
  g.__indexerKicked = true;

  const { runIndexer } = await import("./lib/indexer");
  // Fire-and-forget; do not block server boot.
  runIndexer().catch((err) => {
    console.error("[indexer] boot run failed", err);
  });
}
