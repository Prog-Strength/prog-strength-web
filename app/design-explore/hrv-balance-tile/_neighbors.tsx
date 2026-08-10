/**
 * Static neighbour tiles for the in-grid composition mock.
 *
 * The HRV Balance tile never sits alone — it lands in a user-composed grid
 * beside up to fifteen others, including four sibling recovery tiles. Two of
 * the ticket's selection criteria can only be judged in that company:
 *
 *   - "Does it stay distinct from recovery_trend and morning_vitals?" They may
 *     be on the same grid, and they already print this metric family. If the
 *     new tile's biggest figure is a trend delta, the dashboard owns two trend
 *     tiles.
 *   - "Is it calm?" It sits next to Steps and Blood Pressure. Thirty coloured
 *     dots can very easily become the loudest thing on the dashboard.
 *
 * Deliberately rough approximations of the shipped tiles — enough to judge
 * weight and colour against, not a re-implementation. Throwaway.
 */

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={`${PANEL} flex flex-col gap-3`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
      {children}
    </div>
  );
}

/** The trend tile that already heroes a delta for this metric family. */
export function RecoveryTrendNeighbor() {
  return (
    <Shell title="Recovery Trend">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--warning)]">
          ▼ 10%
        </span>
      </div>
      <p className="text-[13px] text-[var(--muted)]">falling this week</p>
      <p className="text-[11px] text-[var(--faint)]">
        7-night avg <span className="font-mono tabular-nums text-[var(--muted)]">85 ms</span> vs
        30-night <span className="font-mono tabular-nums text-[var(--muted)]">88 ms</span>
      </p>
    </Shell>
  );
}

/** The tile that already prints today's HRV in a three-column stat cell. */
export function MorningVitalsNeighbor() {
  const cell = (label: string, value: string, unit: string) => (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </span>
      <span className="text-lg font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
        {value}
        <span className="ml-0.5 text-[10px] font-medium text-[var(--muted)]">{unit}</span>
      </span>
    </div>
  );
  return (
    <Shell title="Morning Vitals">
      <div className="grid grid-cols-3 gap-2 py-1">
        {cell("HRV", "77", "ms")}
        {cell("RHR", "59", "bpm")}
        {cell("Recovery", "61", "%")}
      </div>
      <p className="text-[11px] text-[var(--faint)]">this morning · Whoop</p>
    </Shell>
  );
}

export function StepsNeighbor() {
  const bars = [62, 88, 41, 95, 70, 100, 54];
  return (
    <Shell title="Steps">
      <div className="flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          8,412
        </span>
        <span className="text-xs text-[var(--muted)]">/ 10,000</span>
      </div>
      <div className="flex h-8 items-end gap-1">
        {bars.map((b, i) => (
          <div
            key={i}
            className="flex-1 rounded-[2px] bg-[var(--surface-3)]"
            style={{ height: `${b}%` }}
          />
        ))}
      </div>
      <p className="text-[11px] text-[var(--faint)]">4 of 7 days on goal</p>
    </Shell>
  );
}

export function BloodPressureNeighbor() {
  return (
    <Shell title="Blood Pressure">
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          118
        </span>
        <span className="text-lg text-[var(--faint)]">/</span>
        <span className="text-2xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          74
        </span>
        <span className="ml-0.5 text-xs text-[var(--muted)]">mmHg</span>
      </div>
      <p className="text-[13px] text-[var(--success)]">Normal</p>
      <p className="text-[11px] text-[var(--faint)]">logged 2 days ago</p>
    </Shell>
  );
}
