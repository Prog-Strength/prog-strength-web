// app/(app)/settings/_components/SaveBar.tsx

export function SaveBar({
  dirtyCount,
  canSave,
  blockReason,
  savedFlash,
  saving,
  onSave,
  onDiscard,
}: {
  dirtyCount: number;
  canSave: boolean;
  blockReason: string | null;
  savedFlash: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}) {
  // Render only when there's something to say.
  if (dirtyCount === 0 && !savedFlash) return null;

  const left = savedFlash ? (
    <span className="text-sm font-medium text-[var(--success)]">All changes saved ✓</span>
  ) : !canSave && blockReason ? (
    <span className="text-sm text-[var(--muted)]">{blockReason}</span>
  ) : (
    <span className="text-sm font-medium text-[var(--foreground)]">
      {dirtyCount} unsaved {dirtyCount === 1 ? "change" : "changes"}
    </span>
  );

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-4 z-10 mx-auto flex w-full items-center justify-between gap-4 rounded-2xl border border-[var(--accent-line)] bg-[var(--surface)] px-5 py-3 shadow-lg"
    >
      {left}
      {!savedFlash && (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onDiscard}
            disabled={saving}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-50"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!canSave || saving}
            className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-sm font-semibold text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </div>
  );
}
