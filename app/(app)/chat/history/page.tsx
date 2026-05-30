"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import {
  deleteChatSession,
  listChatSessions,
  type ChatSessionListItem,
} from "@/lib/api";

/**
 * Chat history list. Sister surface to /chat: same data domain
 * (persistent chat sessions), but presented as a scannable
 * timeline rather than a single active conversation. Tapping a row
 * navigates to /chat?session=<id> which the chat page resumes from.
 *
 * Deletes are user-initiated soft-deletes on the API side; we
 * optimistically remove the row from the list and let the request
 * fly. On failure the row gets restored and an inline error
 * surfaces — same pattern the workouts list uses for its row deletes.
 */
export default function ChatHistoryPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    listChatSessions(token)
      .then(setSessions)
      .catch((err: Error) => {
        if (err.message.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(err.message);
      });
  }, [router]);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleDelete = async (session: ChatSessionListItem) => {
    const label = session.title.trim() || "this chat";
    if (
      !window.confirm(
        `Delete "${label}"? The conversation is removed from your history.`,
      )
    ) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // Optimistic remove. Snapshot the row so we can put it back on
    // failure rather than refetching the whole list — keeps the
    // already-scrolled-to position stable.
    const previous = sessions ?? [];
    setSessions(previous.filter((s) => s.id !== session.id));
    try {
      await deleteChatSession(token, session.id);
    } catch (e) {
      setSessions(previous);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-6 py-3">
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold tracking-tight">Chat history</h1>
          <p className="text-xs text-[var(--muted)]">
            Past conversations. Tap one to resume where you left off.
          </p>
        </div>
        <Link
          href="/chat"
          className="rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-90"
        >
          + New chat
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && sessions === null && (
            <p className="text-sm text-[var(--muted)]">Loading…</p>
          )}

          {sessions && sessions.length === 0 && (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
              <p className="text-sm font-medium">No past chats yet</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Start a conversation and it&apos;ll appear here.
              </p>
            </div>
          )}

          {sessions &&
            sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onDelete={() => handleDelete(s)}
              />
            ))}
        </div>
      </div>
    </main>
  );
}

function SessionRow({
  session,
  onDelete,
}: {
  session: ChatSessionListItem;
  onDelete: () => void;
}) {
  const title = session.title.trim() || "New chat";
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-stretch">
        <Link
          href={`/chat?session=${encodeURIComponent(session.id)}`}
          className="flex min-w-0 flex-1 flex-col gap-0.5 px-4 py-3 transition hover:bg-[var(--surface-2)]"
        >
          <span className="truncate text-sm font-medium">{title}</span>
          <span className="truncate text-xs text-[var(--muted)]">
            {session.message_count}{" "}
            {session.message_count === 1 ? "message" : "messages"} ·{" "}
            {formatRelative(session.last_message_at)}
          </span>
        </Link>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete chat session"
          title="Delete chat session"
          className="flex shrink-0 items-center border-l border-[var(--border)] px-3 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

/**
 * "5 minutes ago", "2 days ago", "May 30, 2026" — short, scannable
 * timestamps for the history list. Falls through to absolute date
 * once we cross ~30 days; the eviction cap means anything older than
 * that probably isn't useful as relative anyway.
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.round(diffSec / 60);
  if (min < 60) return `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} ${hr === 1 ? "hour" : "hours"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} ${day === 1 ? "day" : "days"} ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
