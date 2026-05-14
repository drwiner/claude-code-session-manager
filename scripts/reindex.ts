#!/usr/bin/env tsx
import { runIndexer } from "../src/lib/indexer";

runIndexer()
  .then((stats) => {
    console.log("done", stats);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
