/**
 * Compact gridded summary band for the run detail ledger. Pure and
 * prop-driven: the page pre-formats the eight summary cells (distance, time,
 * paces, HR, calories, elevation) and passes link context. When the run is
 * linked to a plan, a green-teal ✓ pill names the plan with an Unlink action
 * beside it, and the plan's prescription text shows as a muted context line.
 *
 * Tokens only (design-system v0.4): green-teal discipline-run hue for the ✓
 * pill, faint/muted text, surface cells, hairline dividers.
 */
type Cell = { label: string; value: string };

export function RunHeaderBand({
  cells,
  planName,
  prescription,
  onUnlink,
  unlinking,
}: {
  cells: Cell[];
  planName?: string | null;
  prescription?: string | null;
  onUnlink?: () => void;
  unlinking?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {planName && (
        <div className="flex items-center gap-3">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{
              background: "var(--discipline-run-bg)",
              color: "var(--discipline-run-fg)",
            }}
          >
            ✓ {planName}
          </span>
          {onUnlink && (
            <button
              type="button"
              onClick={onUnlink}
              disabled={unlinking}
              className="text-xs text-[var(--muted)] transition hover:text-[var(--danger)] disabled:opacity-50"
            >
              {unlinking ? "Unlinking…" : "Unlink"}
            </button>
          )}
        </div>
      )}

      {prescription && <p className="text-xs text-[var(--muted)]">{prescription}</p>}

      <div className="grid grid-cols-4 divide-x divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] sm:grid-cols-8">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-[var(--surface)] px-3 py-2">
            <p className="text-sm font-semibold tabular-nums tracking-[-0.03em]">{cell.value}</p>
            <p className="mt-0.5 text-[9px] uppercase tracking-wider text-[var(--faint)]">
              {cell.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
