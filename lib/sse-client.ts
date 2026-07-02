// Pure SSE frame parser for the client side of /api/ask/stream (Task D-2b).
//
// POST bodies can't use EventSource, so the caller reads the response body via
// fetch + ReadableStream + TextDecoder and feeds raw chunks through this function.
// Kept side-effect free (no fetch/DOM here) so it is unit-testable without mocking
// the network stack.

import type { AskProgressEvent } from "@/lib/ask-progress";

export type ParseSseChunkResult = {
  events: AskProgressEvent[];
  rest: string;
};

/**
 * Parses as many complete "data: {json}\n\n" frames as are present in
 * `buffer + chunk`, returning the parsed events plus whatever trailing text
 * did not yet form a complete frame (to be passed back in as `buffer` on the
 * next call). Malformed frames (complete but not valid JSON) are skipped
 * rather than thrown — one bad frame must not break the rest of the stream.
 */
export function parseSseChunk(buffer: string, chunk: string): ParseSseChunkResult {
  const combined = buffer + chunk;
  const frames = combined.split("\n\n");
  // The final element is either "" (combined ended exactly on a frame
  // boundary) or an incomplete trailing frame — either way it is not yet
  // complete, so it becomes the next buffer rather than being parsed now.
  const rest = frames.pop() ?? "";

  const events: AskProgressEvent[] = [];
  for (const frame of frames) {
    const line = frame.trim();
    if (!line) continue;
    if (!line.startsWith("data:")) continue;
    const json = line.slice("data:".length).trim();
    if (!json) continue;
    try {
      events.push(JSON.parse(json) as AskProgressEvent);
    } catch {
      // Incomplete/malformed JSON in an otherwise-complete frame — drop it
      // rather than crashing the stream reader.
    }
  }

  return { events, rest };
}
