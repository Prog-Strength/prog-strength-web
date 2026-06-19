/**
 * Kpi — one cell of the top KPI strip.
 *
 * A stacked label + mono value with an optional status-encoded delta and an
 * optional discipline dot. The delta is colour-encoded by SEMANTIC status —
 * `--success` for a good/up move, `--danger` for a bad/down move — and never
 * the periwinkle accent (accent is reserved for command/active chrome). The
 * discipline dot tints by domain (run = sage, lift = periwinkle) purely as a
 * domain marker, distinct from the delta's status meaning.
 */

import type { ReactNode } from "react";

export type KpiDelta = {
  /** Pre-formatted delta text, e.g. "+12%" or "-3%". */
  text: string;
  /** Semantic direction — drives the colour, NOT the arithmetic sign. */
  tone: "good" | "bad";
};

export type KpiDiscipline = "run" | "lift";

export function Kpi({
  label,
  value,
  unit,
  delta,
  discipline,
}: {
  label: string;
  value: ReactNode;
  unit?: ReactNode;
  delta?: KpiDelta | null;
  discipline?: KpiDiscipline | null;
}) {
  const dotColor =
    discipline === "run"
      ? "var(--discipline-run-dot)"
      : discipline === "lift"
        ? "var(--discipline-lift-dot)"
        : null;

  return (
    <div className="flex flex-col gap-1 px-3 py-2.5">
      <div className="flex items-center gap-1.5">
        {dotColor && (
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span className="truncate text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono text-lg font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          {value}
        </span>
        {unit != null && <span className="text-[11px] text-[var(--muted)]">{unit}</span>}
        {delta && (
          <span
            className="text-[11px] font-medium tabular-nums"
            style={{ color: delta.tone === "good" ? "var(--success)" : "var(--danger)" }}
          >
            {delta.text}
          </span>
        )}
      </div>
    </div>
  );
}
