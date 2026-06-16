"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { deleteChatSession, listChatSessions, type ChatSessionListItem } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { PlusIcon, SearchIcon, TrashIcon } from "./icons";

/**
 * Persistent conversation pane for the chat surface. Replaces the
 * slide-in history drawer as the home for past sessions: always
 * mounted, fetched once on mount, with a local search filter on top.
 *
 * Data logic mirrors the old drawer — optimistic delete with
 * snapshot/rollback, 401 → clearToken + redirect to /login — but the
 * shell is a column, not a drawer.
 */
export function ConversationList({
  activeSessionId,
  onNewChat,
  className,
}: {
  activeSessionId: string | null;
  onNewChat?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  // Fetch once on mount. Unlike the drawer (which refetched on each
  // open), this pane is always visible, so a single load is enough;
  // the chat page resumes/creates sessions and can nudge a remount if
  // it ever needs the list refreshed.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setError(null);
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

  const handleResume = (session: ChatSessionListItem) => {
    router.push(`/chat?session=${encodeURIComponent(session.id)}`);
  };

  const handleDelete = async (session: ChatSessionListItem) => {
    const label = session.title.trim() || "this chat";
    if (!window.confirm(`Delete "${label}"? The conversation is removed from your history.`)) {
      return;
    }
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    // Optimistic remove. Snapshot the row so we can put it back on
    // failure rather than refetching the whole list.
    const previous = sessions ?? [];
    setSessions(previous.filter((s) => s.id !== session.id));
    try {
      await deleteChatSession(token, session.id);
      // Deleting the currently-active session resets the chat surface
      // to a fresh conversation; without this the page would try to
      // rehydrate a row that no longer exists.
      if (session.id === activeSessionId) {
        router.push("/chat");
      }
    } catch (e) {
      setSessions(previous);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const filtered = (sessions ?? []).filter((s) =>
    s.title.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div
      className={`flex h-full w-72 flex-col border-r border-[var(--border)] bg-[var(--surface)] ${
        className ?? ""
      }`}
    >
      <header className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-tight">Chats</h2>
        <button
          type="button"
          onClick={() => onNewChat?.()}
          aria-label="New chat"
          title="New chat"
          className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <PlusIcon />
        </button>
      </header>

      <div className="px-3 pb-2">
        <div className="flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-3 py-1.5 text-[var(--muted)]">
          <SearchIcon />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search chats"
            placeholder="Search chats"
            className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {error && (
          <div className="mb-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
            {error}
          </div>
        )}

        {!error && sessions === null && (
          <p className="px-2 py-3 text-xs text-[var(--muted)]">Loading…</p>
        )}

        {sessions && sessions.length === 0 && (
          <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] p-4 text-center">
            <p className="text-xs font-medium">No past chats yet</p>
            <p className="mt-1 text-[10px] text-[var(--muted)]">
              Start a conversation and it&apos;ll appear here.
            </p>
          </div>
        )}

        {sessions && sessions.length > 0 && filtered.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-[var(--muted)]">
            No chats match &ldquo;{query.trim()}&rdquo;.
          </p>
        )}

        {sessions && sessions.length > 0 && filtered.length > 0 && (
          <ul className="flex flex-col gap-1">
            {filtered.map((s) => (
              <li key={s.id}>
                <SessionRow
                  session={s}
                  active={s.id === activeSessionId}
                  onResume={() => handleResume(s)}
                  onDelete={() => handleDelete(s)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SessionRow({
  session,
  active,
  onResume,
  onDelete,
}: {
  session: ChatSessionListItem;
  active: boolean;
  onResume: () => void;
  onDelete: () => void;
}) {
  const title = session.title.trim() || "New chat";
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-[var(--radius-card)] border ${
        active
          ? "border-[var(--accent-line)] bg-[var(--accent-soft)]"
          : "border-transparent hover:bg-[var(--surface-2)]"
      }`}
    >
      <button
        type="button"
        onClick={onResume}
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left transition"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--muted)]">
          <BrandMark size={16} />
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs font-medium">{title}</span>
          <span className="truncate text-[10px] text-[var(--muted)]">
            {session.message_count} {session.message_count === 1 ? "message" : "messages"} ·{" "}
            {formatRelative(session.last_message_at)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete chat session"
        title="Delete chat session"
        className="flex shrink-0 items-center px-3 text-[var(--muted)] transition hover:text-[var(--danger)]"
      >
        <TrashIcon />
      </button>
    </div>
  );
}

/**
 * "5 minutes ago", "2 days ago", "May 30, 2026" — short, scannable
 * timestamps for the conversation list. Falls through to absolute date
 * once we cross ~30 days.
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
