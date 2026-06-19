"use client";

/**
 * VARIANT 2 / 5 — idiom: leaderboard-rows
 * ----------------------------------------------------------------------------
 * The trophy case as a RANKED LIST, not a grid. One dense row per lift,
 * ordered by readiness (gapPct descending), with strong horizontal hierarchy:
 * rank · name · big tabular PR figure · estimate · a degree-of-readiness chip
 * that SCALES with the gap. Never-PR'd lifts sink into a quiet "Not yet tested"
 * group at the bottom — finally a deliberate home for the empty state.
 *
 *   Draws on : Linear's earned row density (tabular alignment, hairline
 *              grouping, single-accent restraint) + Strava segment leaderboards.
 *   Type scale: compact; the PR figure is the one big tabular number per row.
 *   Color logic: structural — the #1 row earns the accent rail; the readiness
 *              chip earns warning (toned by degree); everything else neutral.
 *   Spacing  : tight rows, column-aligned, scannable top-to-bottom.
 *
 * Throwaway DX mockup — static fixtures, no data wiring.
 */

import type { PersonalRecord } from "@/lib/api";
import {
  deriveReadiness,
  fmtAgo,
  fmtNum,
  fmtWeight,
  type Readiness,
  type RenderMode,
} from "../_fixtures";

export function LeaderboardRows({
  records,
  mode,
}: {
  records: PersonalRecord[];
  mode: RenderMode;
}) {
  const all = records.map(deriveReadiness);
  const ranked = all.filter((r) => r.hasPR).sort((a, b) => (b.gapPct ?? 0) - (a.gapPct ?? 0));
  const untested = all.filter((r) => !r.hasPR);

  return (
    <div className="flex flex-col">
      <Chrome />
      <div className="px-6 py-6">
        {mode === "error" ? (
          <ErrorState />
        ) : mode === "loading" ? (
          <LoadingState />
        ) : (
          <>
            {/* column header */}
            <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_5.5rem_6.5rem] items-center gap-3 border-b border-[var(--border)] px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              <span className="text-right">#</span>
              <span>Lift</span>
              <span className="text-right">PR</span>
              <span className="text-right">Est. 1RM</span>
              <span className="text-right">Readiness</span>
            </div>
            <div className="flex flex-col">
              {ranked.map((r, i) => (
                <Row key={r.record.exercise_id} r={r} rank={i + 1} />
              ))}
            </div>

            {untested.length > 0 && (
              <div className="mt-6">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                  Not yet tested
                </p>
                <div className="flex flex-col divide-y divide-[var(--border)] rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]/40">
                  {untested.map((r) => (
                    <div
                      key={r.record.exercise_id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="truncate text-sm text-[var(--muted)]">
                        {r.record.exercise_name}
                      </span>
                      <button className="shrink-0 text-xs text-[var(--accent)] transition hover:underline">
                        Set a baseline →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ r, rank }: { r: Readiness; rank: number }) {
  const pct = r.gapPct ?? 0;
  const top = rank === 1;
  return (
    <div
      className={`grid grid-cols-[1.5rem_minmax(0,1fr)_5.5rem_5.5rem_6.5rem] items-center gap-3 border-b border-[var(--border)] px-2 py-2.5 transition hover:bg-[var(--surface)]/60 ${
        top ? "border-l-2 border-l-[var(--accent-line)]" : ""
      }`}
    >
      <span
        className={`text-right text-sm font-semibold tabular-nums ${
          top ? "text-[var(--accent)]" : "text-[var(--faint)]"
        }`}
      >
        {rank}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium tracking-tight" title={r.record.exercise_name}>
          {r.record.exercise_name}
        </p>
        <p className="text-[11px] text-[var(--faint)]">
          {fmtAgo(r.daysSince)}
          {r.isDumbbell && " · per dumbbell"}
        </p>
      </div>
      <div className="text-right">
        <span className="text-lg font-semibold tabular-nums tracking-tight">
          {fmtNum(r.record.weight)}
        </span>
        <span className="ml-0.5 text-[11px] text-[var(--muted)] tabular-nums">
          ×{r.record.reps}
        </span>
      </div>
      <span className="text-right text-sm tabular-nums text-[var(--muted)]">
        {fmtWeight(r.record.current_estimated_1rm, r.record.estimated_1rm_unit)}
      </span>
      <div className="flex justify-end">
        <ReadinessChip pct={pct} gap={r.gap} />
      </div>
    </div>
  );
}

// Degree-of-readiness chip: it scales rather than toggling. Below 5% it's a
// calm "tested" pill; above, warning intensity climbs with the gap.
function ReadinessChip({ pct, gap }: { pct: number; gap: number | null }) {
  if (pct < 5) {
    return (
      <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] font-medium text-[var(--muted)]">
        tested
      </span>
    );
  }
  const intensity = Math.min(1, pct / 30);
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold tabular-nums"
      style={{
        color: "var(--warning)",
        background: `color-mix(in srgb, var(--warning) ${10 + intensity * 22}%, transparent)`,
        border: `1px solid color-mix(in srgb, var(--warning) ${25 + intensity * 40}%, transparent)`,
      }}
    >
      +{fmtNum(gap)} · {pct.toFixed(0)}%
    </span>
  );
}

function Chrome() {
  return (
    <div className="flex flex-col gap-2 border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold tracking-tight">Personal Records</h1>
          <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-medium">
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--foreground)] ring-1 ring-[var(--accent)]">
              Lifts
            </span>
            <span className="rounded-full px-3 py-1 text-[var(--muted)]">Running</span>
          </div>
        </div>
        <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]">
          Customize
        </button>
      </div>
      <p className="text-xs text-[var(--muted)]">
        Ranked by how due each lift is for a new max — most ready at the top.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-px">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-3">
          <div className="h-3 w-3 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-3 flex-1 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-14 animate-pulse rounded-full bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
      Couldn’t load your records. Retry?
    </div>
  );
}
