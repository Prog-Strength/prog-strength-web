// Agent-service client. The agent owns LLM-shaped endpoints — /chat
// streams a response via SSE (called inline from the chat page) and
// /title generates a friendly summary of a conversation for use as a
// chat-session title.
//
// The chat-session itself lives in the API; this module is only the
// agent-side title round-trip the persistent-chat-sessions SOW
// describes. Once we have the title we PATCH it onto the API's
// chat_sessions row via lib/api.ts.
import { config } from "@/lib/config";

/**
 * Shape of one message in the title payload. Same shape /chat takes.
 * Content is a plain string here — assistant tool-use blocks and
 * tool_results don't get sent because they aren't useful for
 * summarizing the conversation topic.
 */
export type TitleMessage = {
  role: "user" | "assistant";
  content: string;
};

/**
 * One block of multimodal message content, shaped exactly like the
 * Anthropic SDK's content blocks. The web composer builds this on the
 * client and posts it to the agent's /chat — the agent forwards it to
 * Claude unchanged. Only `text` and `image` blocks are produced here
 * (the photo-meal-logging SOW: one image plus a text caption per turn).
 *
 * This is the IN-FLIGHT (current-session) shape. It is deliberately
 * distinct from lib/api.ts's persisted `ChatMessage`, whose `content`
 * stays a plain string — image bytes never reach the API; the stored
 * form is the `[image attached] …` placeholder.
 */
export type ContentBlock =
  | { type: "text"; text: string }
  | {
      type: "image";
      source: {
        type: "base64";
        media_type: "image/jpeg" | "image/png" | "image/webp";
        data: string;
      };
    };

/**
 * One message in the in-flight /chat request. `content` is either a
 * plain string (text-only turn, exactly as today) or a list of
 * `ContentBlock`s (a turn carrying an image). Assistant turns in the
 * scrollback are always strings; only user turns ever carry blocks.
 */
export type ChatRequestMessage = {
  role: "user" | "assistant";
  content: string | ContentBlock[];
};

/**
 * Read a Blob as raw base64 (no `data:…;base64,` prefix). Wraps
 * `FileReader.readAsDataURL` and slices off everything up to and
 * including the comma, leaving the payload the Anthropic image block's
 * `source.data` field expects. Rejects if the read fails or returns a
 * non-string result.
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("failed to read blob"));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader did not return a string"));
        return;
      }
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/**
 * Ask the agent's /title endpoint for a 3–6 word summary. Always
 * returns a non-empty string ≤ 80 chars on success; throws on auth
 * failure or transport error. The agent itself has a server-side
 * fallback to a truncated first-user-message slice, so this client
 * doesn't need its own — but callers usually still wrap in a try/
 * catch and fall back locally because a 5xx / network blip
 * shouldn't block the user from getting *some* title.
 */
export async function generateChatTitle(token: string, messages: TitleMessage[]): Promise<string> {
  const resp = await fetch(`${config.agentUrl}/title`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`agent /title returned ${resp.status}: ${text.slice(0, 200)}`);
  }
  const body = (await resp.json()) as { title?: string };
  const title = (body?.title ?? "").trim();
  if (!title) throw new Error("agent /title returned an empty title");
  return title;
}

/**
 * Ask the agent's /speak endpoint for an mp3 of `text` spoken by
 * the configured TTS voice. Returns the raw audio Blob; the caller
 * is responsible for playback (typically by handing it to
 * URL.createObjectURL + new Audio()).
 *
 * Throws on 4xx / 5xx; callers that fire this best-effort after a
 * completed chat stream should wrap in try/catch and silently fall
 * back to text-only mode for that turn rather than surfacing the
 * error inline — voice is enhancement, not core, and a server
 * blip shouldn't stop the conversation.
 */
export async function generateChatSpeech(token: string, text: string): Promise<Blob> {
  const resp = await fetch(`${config.agentUrl}/speak`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ text }),
  });
  if (!resp.ok) {
    // /speak returns plain-text errors (see agent server.py) — read
    // them verbatim so the caller can decide whether to retry, fall
    // back, or surface to the user.
    const detail = await resp.text();
    throw new Error(`agent /speak returned ${resp.status}: ${detail.slice(0, 200)}`);
  }
  return resp.blob();
}
