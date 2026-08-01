/**
 * EditBar — the mode toggle + save controls for the customizable dashboard.
 *
 * View mode shows a single secondary "Customize" pill that enters edit mode.
 * Edit mode swaps in a "Cancel" (discard) pill and a primary "Done" (save)
 * pill; Done is disabled and reads "Saving…" while a save is in flight, and a
 * `saveError` surfaces inline beside it in the danger tone when a save fails.
 */
"use client";

const SECONDARY_PILL =
  "rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--border-strong)]";

const PRIMARY_PILL =
  "rounded-full bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";

export function EditBar({
  mode,
  saving,
  saveError,
  onCustomize,
  onCancel,
  onDone,
}: {
  mode: "view" | "edit";
  saving: boolean;
  saveError: string | null;
  onCustomize: () => void;
  onCancel: () => void;
  onDone: () => void;
}) {
  if (mode === "view") {
    return (
      <div className="flex items-center justify-end">
        <button type="button" onClick={onCustomize} className={SECONDARY_PILL}>
          Customize
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {saveError && <span className="text-sm text-[var(--danger)]">{saveError}</span>}
      <button type="button" onClick={onCancel} className={SECONDARY_PILL}>
        Cancel
      </button>
      <button type="button" onClick={onDone} disabled={saving} className={PRIMARY_PILL}>
        {saving ? "Saving…" : "Done"}
      </button>
    </div>
  );
}
