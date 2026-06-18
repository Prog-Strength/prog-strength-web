/**
 * A single headline stat rendered as a calm hairline-panel tile.
 *
 * A quiet instrument: a soft surface card with a hairline border, a
 * large tabular value, and a faint uppercase label. The optional `sub`
 * line carries a small secondary annotation (a delta, a run count, a
 * context label); `tone` colors the value for positive/negative deltas.
 * Used across the Activities views (Overview/Running/Steps), the run
 * history list, and the run-detail page so the surfaces read as one
 * design language.
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
      ? "text-[var(--success)]"
      : tone === "negative"
        ? "text-[var(--danger)]"
        : "text-[var(--foreground)]";
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className={`text-2xl font-semibold tabular-nums tracking-[-0.03em] ${toneColor}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
        {label}
      </p>
      {sub && <p className="mt-0.5 text-xs tabular-nums text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
