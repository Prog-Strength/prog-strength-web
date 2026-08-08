/**
 * SectionHeader — one dashboard section's header, in view and edit modes.
 *
 * View mode is deliberately quiet: an uppercase label over a hairline rule,
 * plus a collapse control that names its section. An UNTITLED section renders
 * no header at all — no label, no rule — which is what makes the sections
 * feature invisible to a user who has never created one (every pre-sections
 * layout migrated into a single untitled section).
 *
 * Edit mode always renders, untitled or not, because an invisible section
 * would have no handle to drag, rename, delete, or add into. It swaps the
 * label for an inline title input and adds the drag handle, the delete button,
 * and an "Add tile" affordance that opens the tray targeted at this section.
 */
"use client";

import { MAX_SECTION_TITLE_LEN } from "./layout-ops";

const CHROME =
  "flex h-6 w-6 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition";

export function SectionHeader({
  title,
  index,
  collapsed,
  tileCount,
  mode,
  onToggleCollapsed,
  onRename,
  onDelete,
  onAddTile,
  dragHandle,
}: {
  title: string;
  /** Zero-based position, used to name an untitled section positionally. */
  index: number;
  collapsed: boolean;
  tileCount: number;
  mode: "view" | "edit";
  onToggleCollapsed: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onAddTile: () => void;
  /** The sortable drag handle, supplied by the section's sortable wrapper. */
  dragHandle?: React.ReactNode;
}) {
  // Two untitled sections would otherwise carry identical accessible names on
  // their rename/delete/reorder controls. Numbering matches the add-tile
  // tray's picker, so the same section reads the same way in both places.
  const name = title || `Untitled section ${index + 1}`;

  if (mode === "view") {
    if (!title) return null;
    return (
      <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-2">
        <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          {title}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {collapsed && tileCount > 0 && (
            <span className="text-xs text-[var(--faint)]">
              {tileCount} {tileCount === 1 ? "tile" : "tiles"}
            </span>
          )}
          <CollapseButton name={name} collapsed={collapsed} onToggle={onToggleCollapsed} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2">
      {dragHandle}
      <input
        type="text"
        value={title}
        maxLength={MAX_SECTION_TITLE_LEN}
        onChange={(e) => onRename(e.target.value)}
        placeholder="Section title"
        aria-label={`Title for ${name}`}
        className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-line)]"
      />
      <button
        type="button"
        onClick={onAddTile}
        className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--accent)] transition hover:border-[var(--accent)] hover:bg-[var(--surface-2)]"
      >
        Add tile
      </button>
      <button
        type="button"
        aria-label={`Delete ${name}`}
        onClick={onDelete}
        className={`${CHROME} shrink-0 hover:border-[var(--danger)] hover:text-[var(--danger)]`}
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4 4l8 8M12 4l-8 8" />
        </svg>
      </button>
    </div>
  );
}

function CollapseButton({
  name,
  collapsed,
  onToggle,
}: {
  name: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? `Expand ${name}` : `Collapse ${name}`}
      className={`${CHROME} hover:text-[var(--foreground)]`}
    >
      <svg
        viewBox="0 0 16 16"
        className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
