"use client";

/**
 * The pinned detail pane of the personal-records master/detail view. Always
 * present beside the ledger, it shows the selected record's featured chart
 * plus headline numbers, switching on `view`:
 *
 *   - Lifts:   the selected lift's est-1RM line + logged-PR headline, with a
 *              "go for a max" cue when the estimate has pulled ahead of the PR.
 *   - Running: the selected distance's max-effort projection (with confidence
 *              band) + recent attempts and a link to the full estimate page.
 *
 * Each variant fires its own TanStack Query LAZILY (on first selection, cached
 * for the page lifetime). To keep hooks unconditional, `PRDetail` only branches
 * on `view` and renders `<LiftDetail>` or `<RunDetail>`; each child owns its
 * query, its placeholder, and its own empty/insufficient states.
 */

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getToken } from "@/lib/auth";
import { getExerciseOneRMHistory, getRunningMaxEffort, type PersonalRecord } from "@/lib/api";
import { formatDuration } from "@/lib/format";
import {
  humanizeConfidence,
  humanizeSource,
} from "@/app/(app)/progress/running/[distanceKey]/_components/format";
import { FeaturedEstimateChart } from "./FeaturedEstimateChart";
import { deriveReadiness } from "./readiness";
import { formatWeight, formatDate } from "./format";
import type { PRView } from "./ViewSwitcher";

export type PRDetailProps = {
  view: PRView;
  liftRecord: PersonalRecord | null;
  distanceKey: string | null;
  distanceLabel: string | null;
};

const PANEL =
  "rounded-[14px] border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-3";
const HEADING = "text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]";

function Placeholder() {
  return <p className="text-sm text-[var(--muted)]">Select a record to see its estimate.</p>;
}

export function PRDetail({ view, liftRecord, distanceKey, distanceLabel }: PRDetailProps) {
  if (view === "lifts") {
    if (!liftRecord) return <Placeholder />;
    return <LiftDetail liftRecord={liftRecord} />;
  }
  if (!distanceKey) return <Placeholder />;
  return <RunDetail distanceKey={distanceKey} distanceLabel={distanceLabel} />;
}

function LiftDetail({ liftRecord }: { liftRecord: PersonalRecord }) {
  const d = deriveReadiness(liftRecord);

  const query = useQuery({
    queryKey: ["pr-history-detail", "lifts", liftRecord.exercise_id],
    queryFn: () => getExerciseOneRMHistory(getToken() ?? "", liftRecord.exercise_id),
    enabled: d.hasPR,
    staleTime: 60_000,
  });

  if (!d.hasPR) {
    return (
      <div className={PANEL}>
        <h2 className={HEADING}>Estimated 1RM · progress toward a new max</h2>
        <p className="text-base font-semibold">{liftRecord.exercise_name}</p>
        <p className="text-sm text-[var(--muted)]">
          Log a heavy set on this lift to start its estimate.
        </p>
      </div>
    );
  }

  const history = query.data;
  const estUnit = liftRecord.estimated_1rm_unit ?? liftRecord.unit ?? "";
  const estFigure =
    liftRecord.current_estimated_1rm === null
      ? "—"
      : `${Math.round(liftRecord.current_estimated_1rm)} ${estUnit}`;

  const chartData = (history?.points ?? []).map((p) => ({
    t: new Date(p.performed_at).getTime(),
    value: p.estimated_1rm,
  }));

  return (
    <div className={PANEL}>
      <h2 className={HEADING}>Estimated 1RM · progress toward a new max</h2>
      <p className="text-base font-semibold">{liftRecord.exercise_name}</p>
      <p className="text-xs text-[var(--muted)]">
        {formatWeight(liftRecord.weight, liftRecord.unit)}
        {d.isDumbbell ? " ea" : ""} · {liftRecord.reps} reps · {formatDate(liftRecord.achieved_at)}
      </p>
      <p className="text-3xl font-semibold tabular-nums">{estFigure}</p>
      {d.ready && d.gap !== null && (
        <p className="text-sm font-medium text-[var(--warning)]">
          +{Math.round(d.gap)} over PR — go for a max
        </p>
      )}
      <FeaturedEstimateChart
        data={chartData}
        referenceValue={liftRecord.weight ?? 0}
        referenceLabel={`logged PR ${formatWeight(liftRecord.weight, liftRecord.unit)}`}
        formatY={(v) => String(Math.round(v))}
        lineColor="var(--discipline-lift-dot)"
        isPending={query.isPending}
        isError={query.isError}
      />
    </div>
  );
}

function RunDetail({
  distanceKey,
  distanceLabel,
}: {
  distanceKey: string;
  distanceLabel: string | null;
}) {
  const query = useQuery({
    queryKey: ["running-max-effort", distanceKey],
    queryFn: () => getRunningMaxEffort(getToken() ?? "", distanceKey),
    staleTime: 60_000,
  });

  const detail = query.data;
  const insufficient =
    !!detail && (detail.estimate === null || detail.estimate.basis === "insufficient_data");

  if (query.isPending) {
    return (
      <div className={PANEL}>
        <h2 className={HEADING}>Max-effort estimate · progress toward a new best</h2>
        {distanceLabel && <p className="text-base font-semibold">{distanceLabel}</p>}
        <p className="text-sm text-[var(--muted)]">Loading estimate…</p>
        <FeaturedEstimateChart
          data={[]}
          referenceValue={0}
          referenceLabel=""
          formatY={formatDuration}
          hasBand
          lowerIsFasterNote
          lineColor="var(--discipline-run-dot)"
          isPending
        />
      </div>
    );
  }

  if (detail && insufficient) {
    return (
      <div className={PANEL}>
        <h2 className={HEADING}>Max-effort estimate · progress toward a new best</h2>
        {distanceLabel && <p className="text-base font-semibold">{distanceLabel}</p>}
        <p className="text-sm font-medium">Not enough data yet</p>
        <p className="text-xs text-[var(--muted)]">
          Log a run at this distance to see an estimate for the {distanceLabel}.
        </p>
      </div>
    );
  }

  // detail && !insufficient → estimate is non-null. If the query errored, fall
  // through to the chart's own error state (estimate is null here so guard).
  if (!detail || !detail.estimate) {
    return (
      <div className={PANEL}>
        <h2 className={HEADING}>Max-effort estimate · progress toward a new best</h2>
        {distanceLabel && <p className="text-base font-semibold">{distanceLabel}</p>}
        <FeaturedEstimateChart
          data={[]}
          referenceValue={0}
          referenceLabel=""
          formatY={formatDuration}
          hasBand
          lowerIsFasterNote
          lineColor="var(--discipline-run-dot)"
          isError={query.isError}
        />
      </div>
    );
  }

  const { estimate, actual_best } = detail;
  const inReach = !!actual_best && estimate.seconds < actual_best.seconds;

  const chartData = detail.estimate_history.map((p) => ({
    t: new Date(p.as_of).getTime(),
    value: p.seconds,
    lower: p.lower_seconds,
    upper: p.upper_seconds,
  }));

  return (
    <div className={PANEL}>
      <h2 className={HEADING}>Max-effort estimate · progress toward a new best</h2>
      {distanceLabel && <p className="text-base font-semibold">{distanceLabel}</p>}
      <p className="text-xs text-[var(--muted)]">
        {humanizeConfidence(estimate.confidence)} · {formatDuration(estimate.lower_seconds)}–
        {formatDuration(estimate.upper_seconds)} · best{" "}
        {actual_best ? formatDuration(actual_best.seconds) : "—"}
      </p>
      <p className="text-3xl font-semibold tabular-nums">{formatDuration(estimate.seconds)}</p>
      {inReach && (
        <p className="text-sm font-medium text-[var(--success)]">under best — PR in reach</p>
      )}
      <FeaturedEstimateChart
        data={chartData}
        referenceValue={actual_best?.seconds ?? estimate.seconds}
        referenceLabel={`logged best ${actual_best ? formatDuration(actual_best.seconds) : "—"}`}
        formatY={formatDuration}
        hasBand
        lowerIsFasterNote
        lineColor="var(--discipline-run-dot)"
        isPending={query.isPending}
        isError={query.isError}
      />
      {detail.attempts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {detail.attempts.slice(0, 5).map((a) => (
            <span
              key={a.activity_id}
              className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px]"
            >
              {formatDuration(a.duration_seconds)} · {humanizeSource(a.source)}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/progress/running/${distanceKey}`}
        className="text-xs text-[var(--accent)] hover:underline"
      >
        View full estimate →
      </Link>
    </div>
  );
}
