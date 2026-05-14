import { createReadStream } from "fs";
import { open } from "fs/promises";

/**
 * Stream a JSONL file line-by-line, yielding the parsed value plus the
 * byte range it occupied (inclusive start, exclusive end, including the
 * trailing newline). Byte ranges let us slice the file later to fetch
 * specific turns without re-parsing the whole transcript.
 */
export async function* streamJsonl<T = unknown>(
  filePath: string,
): AsyncGenerator<{ value: T; byteStart: number; byteEnd: number; lineNumber: number }> {
  const stream = createReadStream(filePath, { encoding: "utf8", highWaterMark: 64 * 1024 });
  let buffer = "";
  let byteCursor = 0;
  let lineStart = 0;
  let lineNumber = 0;

  for await (const chunk of stream) {
    buffer += chunk;
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const rawLine = buffer.slice(0, newlineIdx);
      const lineByteLen = Buffer.byteLength(rawLine, "utf8") + 1; // +1 for "\n"
      const start = lineStart;
      const end = lineStart + lineByteLen;
      lineStart = end;
      byteCursor = end;
      buffer = buffer.slice(newlineIdx + 1);
      lineNumber += 1;
      const trimmed = rawLine.trim();
      if (trimmed.length === 0) continue;
      try {
        const value = JSON.parse(trimmed) as T;
        yield { value, byteStart: start, byteEnd: end, lineNumber };
      } catch {
        // Skip malformed lines; they shouldn't exist but if they do we don't
        // want one bad record to kill the whole index.
      }
    }
  }

  // Trailing line with no newline
  if (buffer.trim().length > 0) {
    const lineByteLen = Buffer.byteLength(buffer, "utf8");
    lineNumber += 1;
    try {
      const value = JSON.parse(buffer.trim()) as T;
      yield { value, byteStart: lineStart, byteEnd: lineStart + lineByteLen, lineNumber };
    } catch {
      // ignore
    }
    byteCursor = lineStart + lineByteLen;
  }
  // Silence unused-var lint if any (byteCursor is informational)
  void byteCursor;
}

/**
 * Read a byte slice of a file as utf8 and parse each line as JSON.
 * Used by loadTurnDetail to fetch a specific turn without scanning the
 * whole file.
 */
export async function readJsonlSlice<T = unknown>(
  filePath: string,
  byteStart: number,
  byteEnd: number,
): Promise<T[]> {
  const fh = await open(filePath, "r");
  try {
    const length = Math.max(0, byteEnd - byteStart);
    const buf = Buffer.alloc(length);
    if (length > 0) await fh.read(buf, 0, length, byteStart);
    const text = buf.toString("utf8");
    const out: T[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        out.push(JSON.parse(trimmed) as T);
      } catch {
        // skip
      }
    }
    return out;
  } finally {
    await fh.close();
  }
}
