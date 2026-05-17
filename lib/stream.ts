/**
 * Tiny SSE parser for streaming chat responses from the agent.
 *
 * The agent's /chat endpoint emits server-sent events as `data: <json>`
 * lines separated by blank lines. We don't use EventSource because that
 * doesn't let you set custom headers (we need Authorization: Bearer).
 * Instead: fetch + ReadableStream + manual line splitting.
 */

export type StreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use_start"; name: string }
  | { type: "tool_result"; name: string; is_error: boolean }
  | { type: "done"; stop_reason: string }
  | { type: "error"; message: string };

/**
 * Parse `body` (a ReadableStream of an SSE response) and yield each event
 * as it arrives. The caller drives the loop with `for await`.
 *
 * Spec-compliant SSE separates events by `\n\n`. We buffer between reads
 * to handle the case where an event boundary falls mid-chunk.
 */
export async function* parseSSE(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Each iteration peels off complete events; whatever's left in
      // `buffer` after the last `\n\n` may be a partial event waiting
      // on bytes from the next read.
      let separatorIdx;
      while ((separatorIdx = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIdx);
        buffer = buffer.slice(separatorIdx + 2);
        const ev = parseEvent(rawEvent);
        if (ev) yield ev;
      }
    }
    // Drain anything trailing without a final \n\n. Most servers send
    // one, but we shouldn't lose the last event if they don't.
    if (buffer.trim().length > 0) {
      const ev = parseEvent(buffer);
      if (ev) yield ev;
    }
  } finally {
    reader.releaseLock();
  }
}

function parseEvent(raw: string): StreamEvent | null {
  // Multi-line events are allowed by the SSE spec but the agent only
  // emits single-line `data:` events. Strip the prefix from each line
  // we recognize and JSON.parse the result.
  for (const line of raw.split("\n")) {
    if (line.startsWith("data: ")) {
      try {
        return JSON.parse(line.slice(6)) as StreamEvent;
      } catch {
        return null;
      }
    }
  }
  return null;
}
