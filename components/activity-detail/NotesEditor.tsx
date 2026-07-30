"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The `EditableName` idiom at paragraph scale. Renders the athlete's note as
 * first-class prose (click-to-edit), or — when empty — a dashed
 * "How did this run feel?" affordance that opens an inline textarea. Shared
 * across activity detail pages, so the prompt's noun is the caller's to set
 * (`prompt`) — a hike page must not ask how the *run* felt.
 *
 * Editing: a textarea in place (autofocused), commit on blur / ⌘-Ctrl+Enter,
 * Escape reverts. Plain Enter inserts a newline (it's a textarea — never
 * hijacked). Optimistic upstream via `onSave`; an emptied note sends "" which
 * clears server-side. Cap mirrors the API's 2000 chars.
 *
 * Tokens only: field-surface + hairline + accent focus ring per design-system
 * form controls; `--accent`-family only as edit/focus chrome (the SOW's
 * "accent = edit/focus" rule), `--foreground`/`--muted`/`--faint` for prose.
 */
const MAX_NOTES = 2000;

export function NotesEditor({
  notes,
  onSave,
  prompt = "How did this run feel?",
}: {
  notes: string | null | undefined;
  onSave: (next: string) => void;
  // Empty-state prompt, doubling as the textarea placeholder. Defaults to
  // the run wording — the surface that had this copy first.
  prompt?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function start() {
    setDraft(notes ?? "");
    setEditing(true);
  }

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  function commit() {
    if (!editing) return;
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed !== (notes ?? "").trim()) onSave(trimmed);
  }

  if (editing) {
    return (
      <textarea
        ref={textareaRef}
        value={draft}
        maxLength={MAX_NOTES}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setEditing(false);
          }
        }}
        placeholder={prompt}
        rows={4}
        className="w-full resize-y whitespace-pre-wrap rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-base leading-relaxed text-[var(--foreground)] placeholder-[var(--muted)] outline-none focus:border-[var(--accent)]"
      />
    );
  }

  const value = notes?.trim();
  if (!value) {
    return (
      <button
        type="button"
        onClick={start}
        className="w-full rounded-lg border border-dashed border-[var(--accent-line)] px-4 py-3 text-left text-base text-[var(--muted)] transition hover:text-[var(--foreground)] hover:border-[var(--accent)]"
      >
        {prompt}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={start}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          start();
        }
      }}
      title="Click to edit"
      className="group flex cursor-text flex-col gap-1 rounded-lg -mx-2 px-2 py-1 transition hover:bg-[var(--surface)]"
    >
      <p className="whitespace-pre-wrap text-base leading-relaxed text-[var(--foreground)]">
        {value}
      </p>
      <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[var(--faint)] opacity-0 transition group-hover:opacity-100">
        <PencilIcon />
        Edit
      </span>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}
