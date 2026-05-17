"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken, isAuthenticated } from "@/lib/auth";
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

  // Auth gate. Cheaper than a Next middleware for a single page; we
  // already need to be client-side to read localStorage.
  useEffect(() => {
    if (!isAuthenticated()) router.replace("/login");
  }, [router]);

  // Auto-scroll on every message-list change. Sticking the user to the
  // bottom as tokens stream in is the standard chat UX expectation.
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

  const logout = () => {
    clearToken();
    router.replace("/login");
  };

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-3">
        <h1 className="text-sm font-semibold tracking-tight">Prog Strength</h1>
        <button
          type="button"
          onClick={logout}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Sign out
        </button>
      </header>

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
                Try <em>"what chest exercises are in the catalog?"</em> or
                paste a workout log and ask it to record the session.
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
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
          isUser
            ? "bg-[var(--accent)] text-[var(--accent-fg)]"
            : "bg-[var(--surface)] text-[var(--foreground)]"
        }`}
      >
        {content || (
          <span className="inline-block animate-pulse text-[var(--muted)]">
            …
          </span>
        )}
      </div>
    </div>
  );
}
