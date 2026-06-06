/**
 * A single headline stat for the Running dashboard / detail grids.
 *
 * Mirrors the Progress page's StatTile styling (rounded border, surface
 * background, large value, uppercase muted label) so the two surfaces
 * read as one design language. The optional `sub` line carries a small
 * secondary annotation (a delta, a run count, a context label); `tone`
 * colors the value for positive/negative deltas.
 */

export function StatTile({
  value,
  label,
  sub,
  tone = "neutral",
}: {
  value: string;
  label: string;
  sub?: string;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneColor =
    tone === "positive"
      ? "text-[#86efac]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className={`text-2xl font-semibold tracking-tight tabular-nums ${toneColor}`}>{value}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
