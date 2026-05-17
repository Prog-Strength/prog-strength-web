"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clearToken, getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { parseSSE } from "@/lib/stream";

/**
 * A tool the agent invoked during a single assistant turn. State
 * starts as "running" when we see tool_use_start, transitions to "ok"
 * or "error" on tool_result. Persisted on the Message so the history
 * shows "the agent called X to answer this" even after streaming ends.
 */
type ToolCall = {
  name: string;
  state: "running" | "ok" | "error";
};

type Message = {
  role: "user" | "assistant";
  content: string;
  // Only populated on assistant messages — the tools the agent
  // invoked while producing this turn. Order reflects call order.
  tools?: ToolCall[];
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auth-gating lives in the (app) layout; this page assumes a token
  // exists. Auto-scroll on every message-list change — standard chat UX.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, streaming]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setError(null);

    // Optimistic update: append the user's message and a placeholder
    // assistant message we'll fill as deltas arrive. Setting both at
    // once avoids a flash where the user message renders alone.
    const userMsg: Message = { role: "user", content: trimmed };
    const placeholder: Message = { role: "assistant", content: "", tools: [] };
    const nextMessages = [...messages, userMsg];
    setMessages([...nextMessages, placeholder]);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch(`${config.agentUrl}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          // Hint to the server we expect SSE; not required by spec but
          // a useful signal for shared middleware (e.g. Caddy).
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (resp.status === 401) {
        clearToken();
        router.replace("/login");
        return;
      }
      if (!resp.ok || !resp.body) {
        const text = await resp.text();
        throw new Error(`agent returned ${resp.status}: ${text.slice(0, 200)}`);
      }

      let assistantText = "";
      for await (const ev of parseSSE(resp.body)) {
        if (ev.type === "text_delta") {
          assistantText += ev.text;
          // Mutate the text on the last (assistant) message while
          // preserving any tools that were attached during this turn.
          setMessages((prev) =>
            replaceLast(prev, (last) => ({ ...last, content: assistantText })),
          );
        } else if (ev.type === "tool_use_start") {
          // Append a "running" tool to the in-progress assistant
          // message. Persisting tools on the message (rather than a
          // separate activeTools state) keeps them visible after the
          // turn completes — the user can scroll back and see what
          // the agent did for any historical reply.
          setMessages((prev) =>
            replaceLast(prev, (last) => ({
              ...last,
              tools: [
                ...(last.tools ?? []),
                { name: ev.name, state: "running" },
              ],
            })),
          );
        } else if (ev.type === "tool_result") {
          // Flip the matching running tool to ok/error. Match on name
          // + state so parallel tool calls with the same name resolve
          // in order (the in-flight one transitions; later ones wait).
          setMessages((prev) =>
            replaceLast(prev, (last) => ({
              ...last,
              tools: (last.tools ?? []).map((t) =>
                t.name === ev.name && t.state === "running"
                  ? { ...t, state: ev.is_error ? "error" : "ok" }
                  : t,
              ),
            })),
          );
        } else if (ev.type === "error") {
          setError(ev.message);
        }
        // `done` event needs no UI side-effect; the loop ends when the
        // server closes the body.
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      // Roll back the empty placeholder so the user doesn't see a blank
      // assistant bubble after a failure. Only drop the row if no text
      // AND no tool activity had landed — if the agent already produced
      // anything visible we keep it so the user retains context for
      // debugging or retry.
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        const isBlankAssistant =
          last.role === "assistant" &&
          last.content === "" &&
          (!last.tools || last.tools.length === 0);
        if (isBlankAssistant) {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, router]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter inserts a newline. Standard chat UX.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-6 py-6"
        aria-live="polite"
      >
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {messages.length === 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
              <p className="font-medium text-[var(--foreground)]">
                Ask about your training.
              </p>
              <p className="mt-1">
                Try <em>&quot;what chest exercises are in the catalog?&quot;</em>{" "}
                or paste a workout log and ask it to record the session.
              </p>
            </div>
          )}

          {messages.map((m, i) => (
            <MessageBubble
              key={i}
              role={m.role}
              content={m.content}
              tools={m.tools}
            />
          ))}

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--border)] px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Prog Strength…"
            rows={1}
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            disabled={streaming}
          />
          <button
            type="button"
            onClick={send}
            disabled={streaming || input.trim().length === 0}
            className="rounded-lg bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40"
          >
            {streaming ? "…" : "Send"}
          </button>
        </div>
      </footer>
    </main>
  );
}

function MessageBubble({
  role,
  content,
  tools,
}: {
  role: "user" | "assistant";
  content: string;
  tools?: ToolCall[];
}) {
  const isUser = role === "user";
  const hasTools = !isUser && tools && tools.length > 0;
  const hasContent = content.length > 0;

  // User messages render as plain text (the user didn't intentionally
  // write Markdown when typing). Assistant messages render through
  // ReactMarkdown so `**bold**`, lists, code, and tables come out
  // formatted instead of as literal asterisks. `remark-gfm` enables
  // GitHub-flavored Markdown — tables, strikethrough, autolinked URLs,
  // task lists — which Claude tends to use in tool-rich responses.
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "whitespace-pre-wrap bg-[var(--accent)] text-[var(--accent-fg)]"
            : "bg-[var(--surface)] text-[var(--foreground)]"
        }`}
      >
        {hasTools && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {tools.map((t, i) => (
              <ToolPill key={i} tool={t} />
            ))}
          </div>
        )}
        {!hasContent && !hasTools ? (
          // No text and no tools yet — show the typing placeholder.
          // Once tools start arriving the pills act as the in-progress
          // indicator and the placeholder isn't needed.
          <span className="inline-block animate-pulse text-[var(--muted)]">
            …
          </span>
        ) : isUser ? (
          content
        ) : hasContent ? (
          <AssistantMarkdown content={content} />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Persistent indicator that the agent invoked a tool. Each pill shows
 * the tool's humanized name and its state — running (animated dots),
 * ok (check), or error (red x). Stays on the message after the turn
 * completes so the user can scroll back and see which tools answered
 * which prompt.
 */
function ToolPill({ tool }: { tool: ToolCall }) {
  const name = humanizeToolName(tool.name);
  if (tool.state === "running") {
    return (
      <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
        <DotsIcon />
        <span>Calling {name}…</span>
      </span>
    );
  }
  if (tool.state === "ok") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
        <CheckIcon />
        <span>{name}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--danger)]/30 bg-[var(--danger)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
      <XIcon />
      <span>{name} failed</span>
    </span>
  );
}

// --- helpers -----------------------------------------------------------

/**
 * Immutably replace the last element of an array using a transformer.
 * Used during streaming to update the in-progress assistant message
 * (text deltas, tool transitions) without copying the whole array
 * inline at every call site. Returns the original array unchanged if
 * it's empty — defensive against state races on first render.
 */
function replaceLast<T>(arr: T[], fn: (last: T) => T): T[] {
  if (arr.length === 0) return arr;
  const next = arr.slice();
  next[next.length - 1] = fn(next[next.length - 1]);
  return next;
}

/**
 * Display form for the agent's tool names. The MCP tools are snake_case
 * ("list_exercises"); Title Case reads more naturally to the user
 * ("List Exercises") without losing the operation's identity.
 */
function humanizeToolName(name: string): string {
  return name
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// --- icons -------------------------------------------------------------

function DotsIcon() {
  // Three small dots — used inside the running-state pill alongside
  // the surrounding animate-pulse so the whole pill breathes while
  // a tool call is in flight.
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

/**
 * Markdown renderer for assistant turns. Each element is mapped to a
 * Tailwind-styled component so the rendered output sits naturally in
 * the dark chat bubble — no `prose` plugin, no global typography
 * styles to maintain.
 *
 * `react-markdown` is safe-by-default (raw HTML in input is escaped),
 * so we don't need a sanitizer step.
 */
function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Paragraphs: tight by default. The bubble already has padding,
        // so internal margins only need to separate consecutive blocks.
        p: ({ children }) => (
          <p className="my-1 first:mt-0 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        // Lists indent with bullets / numbers; tight vertical rhythm
        // matches the surrounding text.
        ul: ({ children }) => (
          <ul className="my-2 list-disc space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="my-2 list-decimal space-y-1 pl-5 first:mt-0 last:mb-0 marker:text-[var(--muted)]">
            {children}
          </ol>
        ),
        li: ({ children }) => <li className="leading-snug">{children}</li>,
        // Headings inside a chat bubble are usually small (Claude uses
        // them as section labels, not page titles), so we cap the size.
        h1: ({ children }) => (
          <h1 className="mb-2 mt-3 text-base font-semibold first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-2 mt-3 text-sm font-semibold first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2 text-sm font-semibold first:mt-0">
            {children}
          </h3>
        ),
        // Inline `code` gets a subtle background; fenced code blocks
        // get their own dark block + horizontal scroll for long lines.
        code: ({ className, children, ...rest }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="rounded bg-[var(--surface-2)] px-1 py-0.5 font-mono text-[0.85em]"
                {...rest}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={`${className ?? ""} font-mono text-xs`} {...rest}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-md bg-[var(--surface-2)] p-3 first:mt-0 last:mb-0">
            {children}
          </pre>
        ),
        // Links open in a new tab — Claude often surfaces external
        // references and you don't want to lose the chat scroll.
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline-offset-4 hover:underline"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-[var(--border)] pl-3 italic text-[var(--muted)] first:mt-0 last:mb-0">
            {children}
          </blockquote>
        ),
        // GFM tables. Horizontal scroll on overflow so long workout
        // tables don't blow out the bubble width.
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto first:mt-0 last:mb-0">
            <table className="min-w-full border-collapse text-xs">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-b border-[var(--border)] px-2 py-1 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-b border-[var(--border)]/50 px-2 py-1">
            {children}
          </td>
        ),
        hr: () => <hr className="my-3 border-[var(--border)]" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
