"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clearToken, getToken } from "@/lib/auth";
import { deleteChatSession, listChatSessions, type ChatSessionListItem } from "@/lib/api";

/**
 * Right-side drawer surfacing the user's past chat sessions inside
 * the chat page itself. Replaces the standalone /chat/history route
 * so the sidebar can drop its second "Chat history" entry — the
 * surface was always conceptually attached to the chat, not a
 * destination of its own.
 *
 * Behavior:
 * - Closed by default; the chat page header's History pill toggles
 *   `open`. While `open`, Escape and clicking the transparent
 *   backdrop dismiss; the X button in the drawer header also does.
 * - Sessions list is fetched lazily — only when the drawer opens for
 *   the first time, and refetched on every subsequent open so the
 *   list is fresh after a turn or two of conversation lands a new
 *   row server-side.
 * - Row click resumes the session by routing to /chat?session=<id>
 *   (the chat page's mount effect handles rehydration) and closes
 *   the drawer.
 * - Trash removes a session via the existing optimistic-remove
 *   pattern from the deleted history page. Deleting the *active*
 *   session also pushes /chat (no ?session=…) so the chat page
 *   resets to a fresh conversation.
 */
export function ChatHistoryDrawer({
  open,
  activeSessionId,
  onClose,
}: {
  open: boolean;
  activeSessionId: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [sessions, setSessions] = useState<ChatSessionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(() => {
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

  // Lazy + always-fresh: fetch every time the drawer opens. The list
  // is small enough that the network cost is fine, and "I just clicked
  // History, show me my latest" matches user expectations better than
  // staling out a cached copy.
  useEffect(() => {
    if (!open) return;
    reload();
  }, [open, reload]);

  // Escape dismisses, matching the modal pattern used elsewhere.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleResume = (session: ChatSessionListItem) => {
    onClose();
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
    // failure rather than refetching the whole list — keeps the
    // already-scrolled-to position stable.
    const previous = sessions ?? [];
    setSessions(previous.filter((s) => s.id !== session.id));
    try {
      await deleteChatSession(token, session.id);
      // If we just deleted the currently-active session, reset the
      // chat surface to a fresh conversation. Without this the chat
      // page's mount effect would try to rehydrate a row that no
      // longer exists and surface a 404.
      if (session.id === activeSessionId) {
        onClose();
        router.push("/chat");
      }
    } catch (e) {
      setSessions(previous);
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <>
      {/* Transparent backdrop catcher. Sits behind the drawer; clicks
          anywhere on the rest of the chat page close the drawer. Not
          a scrim — the chat stays fully visible underneath. */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={`fixed inset-0 z-30 transition-opacity ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="complementary"
        aria-label="Chat history"
        aria-hidden={!open}
        className={`fixed right-0 top-0 z-40 flex h-full w-72 flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl transition-transform duration-200 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold tracking-tight">History</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--background)] hover:text-[var(--foreground)]"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <div className="mb-2 rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-xs text-[var(--danger)]">
              {error}
            </div>
          )}

          {!error && sessions === null && (
            <p className="px-2 py-3 text-xs text-[var(--muted)]">Loading…</p>
          )}

          {sessions && sessions.length === 0 && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--background)] p-4 text-center">
              <p className="text-xs font-medium">No past chats yet</p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                Start a conversation and it&apos;ll appear here.
              </p>
            </div>
          )}

          {sessions && sessions.length > 0 && (
            <ul className="flex flex-col gap-1">
              {sessions.map((s) => (
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
      </aside>
    </>
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
      className={`flex items-stretch overflow-hidden rounded-md border ${
        active
          ? "border-[var(--accent)] bg-[var(--accent)]/10"
          : "border-transparent bg-[var(--background)] hover:border-[var(--border)]"
      }`}
    >
      <button
        type="button"
        onClick={onResume}
        className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2 text-left transition"
      >
        <span className="truncate text-xs font-medium">{title}</span>
        <span className="truncate text-[10px] text-[var(--muted)]">
          {session.message_count} {session.message_count === 1 ? "message" : "messages"} ·{" "}
          {formatRelative(session.last_message_at)}
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

function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
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
