/**
 * Neutral metadata chip marking an indoor/treadmill run. Per the design
 * system, activity STATUS is encoded via shape + label — not a new activity
 * hue — so this is a surface-2 chip with a hairline border, muted text, a
 * small treadmill glyph, and the word "Treadmill". It never introduces a new
 * color token.
 *
 * Two forms share the one glyph so there's a single source of truth:
 *   - default: the full chip (glyph + "Treadmill" label) for the detail header.
 *   - glyphOnly: just the glyph, for the dense run-list row where the row's
 *     text already gives context and a label would crowd it.
 *
 * Purely presentational — callers gate it on
 * `environment === "indoor" && activity_type === "running"`.
 */
export function TreadmillBadge({
  className = "",
  glyphOnly = false,
}: {
  className?: string;
  glyphOnly?: boolean;
}) {
  const title = "Recorded indoors (treadmill) — distance is user-calibrated and excluded from PRs";

  if (glyphOnly) {
    return (
      <span
        className={`inline-flex items-center text-[var(--muted)] ${className}`}
        title={title}
        aria-label="Treadmill"
      >
        <TreadmillGlyph />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ${className}`}
      title={title}
    >
      <TreadmillGlyph />
      Treadmill
    </span>
  );
}

function TreadmillGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 18h14M6 18l2-8 6 1 3 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="5" r="1.6" fill="currentColor" />
    </svg>
  );
}
