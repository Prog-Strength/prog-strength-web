"use client";

/**
 * The bottom-right expand affordance shared by both card types. A plain
 * `<button aria-expanded>` whose accessible label flips between
 * "Show progression" / "Hide progression" so screen-reader users get the
 * state without seeing the chevron rotate. Cards suppress it entirely when
 * there's nothing to chart (no PR / no record yet).
 */
export function ExpandChevron({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? "Hide progression" : "Show progression"}
      className="self-end rounded-full p-1 text-[var(--muted)] transition hover:text-[var(--foreground)]"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`transition-transform ${expanded ? "rotate-180" : ""}`}
        aria-hidden="true"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
