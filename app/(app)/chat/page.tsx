"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clearToken, getToken } from "@/lib/auth";
import { config } from "@/lib/config";
import { parseSSE } from "@/lib/stream";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ActiveTool = {
  name: string;
  /** true once the tool returned; we keep showing it briefly for context */
  done: boolean;
  error: boolean;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<ActiveTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auth-gating lives in the (app) layout; this page assumes a token
  // exists. Auto-scroll on every message-list change — standard chat UX.
  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, activeTools, streaming]);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || streaming) return;

    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    setError(null);
    setActiveTools([]);

    // Optimistic update: append the user's message and a placeholder
    // assistant message we'll fill as deltas arrive. Setting both at
    // once avoids a flash where the user message renders alone.
    const userMsg: Message = { role: "user", content: trimmed };
    const placeholder: Message = { role: "assistant", content: "" };
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
          // Mutate only the last (assistant) message; everything before
          // it is frozen history.
          setMessages((prev) => {
            const next = prev.slice();
            next[next.length - 1] = {
              role: "assistant",
              content: assistantText,
            };
            return next;
          });
        } else if (ev.type === "tool_use_start") {
          setActiveTools((prev) => [
            ...prev,
            { name: ev.name, done: false, error: false },
          ]);
        } else if (ev.type === "tool_result") {
          setActiveTools((prev) =>
            prev.map((t) =>
              t.name === ev.name && !t.done
                ? { ...t, done: true, error: ev.is_error }
                : t,
            ),
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
      // assistant bubble after a failure.
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        if (last.role === "assistant" && last.content === "") {
          return prev.slice(0, -1);
        }
        return prev;
      });
    } finally {
      setStreaming(false);
      // Clear in-flight tool indicators on turn completion; their state
      // isn't meaningful between turns.
      setActiveTools([]);
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
            <MessageBubble key={i} role={m.role} content={m.content} />
          ))}

          {/* In-flight tool indicators show inline after the streaming
              assistant message; they vanish when the turn completes. */}
          {streaming && activeTools.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeTools.map((t, i) => (
                <span
                  key={i}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs text-[var(--muted)]"
                >
                  {t.done
                    ? t.error
                      ? `${t.name} failed`
                      : `${t.name} ✓`
                    : `Running ${t.name}…`}
                </span>
              ))}
            </div>
          )}

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
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";

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
        {!content ? (
          <span className="inline-block animate-pulse text-[var(--muted)]">
            …
          </span>
        ) : isUser ? (
          content
        ) : (
          <AssistantMarkdown content={content} />
        )}
      </div>
    </div>
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
