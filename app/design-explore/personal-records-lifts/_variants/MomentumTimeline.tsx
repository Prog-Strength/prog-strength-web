"use client";

/**
 * VARIANT 5 / 5 — idiom: momentum-timeline
 * ----------------------------------------------------------------------------
 * PRs reframed around RECENCY and MOMENTUM. Orders lifts by what's most "due"
 * (a stale PR whose estimate has pulled ahead floats to the top), shows
 * time-since-PR prominently, and promotes the per-lift progression SPARK to a
 * glanceable inline trend so you read trajectory without expanding a chart.
 * "Time for a max" becomes structural — about staleness, not a binary badge.
 *
 *   Draws on : Gentler Streak's "due / recovery" framing (order by what needs
 *              attention) + Strava's trend surfaces.
 *   Type scale: medium feed type; the time-since-PR is the prominent figure.
 *   Color logic: driven by due-ness — warm (warning) = stale-and-ready,
 *              calm (steel) = freshly tested. Rail dot carries the temperature.
 *   Spacing  : a vertical feed with a timeline rail; medium feed rhythm.
 *
 * Throwaway DX mockup — static fixtures, no data wiring.
 */

import type { PersonalRecord } from "@/lib/api";
import {
  deriveReadiness,
  fmtAgo,
  fmtNum,
  fmtWeight,
  sparkSeries,
  type Readiness,
  type RenderMode,
} from "../_fixtures";

// Due-ness = how much the estimate has pulled ahead, weighted by staleness.
// Fresh lifts (low days) stay calm even with a gap; stale + big gap floats up.
function dueness(r: Readiness): number {
  if (!r.hasPR || r.gapPct === null || r.daysSince === null) return -1;
  return r.gapPct * (1 + r.daysSince / 30);
}

export function MomentumTimeline({
  records,
  mode,
}: {
  records: PersonalRecord[];
  mode: RenderMode;
}) {
  const all = records.map(deriveReadiness);
  const feed = all.filter((r) => r.hasPR).sort((a, b) => dueness(b) - dueness(a));
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
            <div className="relative pl-6">
              {/* the rail */}
              <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--border-strong)]" />
              <div className="flex flex-col gap-5">
                {feed.map((r) => (
                  <Entry key={r.record.exercise_id} r={r} />
                ))}
              </div>
            </div>

            {untested.length > 0 && (
              <div className="mt-7 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] px-5 py-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
                  Never tested — no clock running
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {untested.map((r) => (
                    <button
                      key={r.record.exercise_id}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
                    >
                      {r.record.exercise_name}{" "}
                      <span className="text-[var(--accent)]">· start →</span>
                    </button>
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

function Entry({ r }: { r: Readiness }) {
  const pct = r.gapPct ?? 0;
  const fresh = pct < 5;
  const stale = (r.daysSince ?? 0) > 30;
  const warm = !fresh && stale; // the "due" temperature
  const intensity = Math.min(1, pct / 30);
  const dotColor = warm
    ? `color-mix(in srgb, var(--warning) ${50 + intensity * 50}%, var(--surface-3))`
    : "var(--discipline-lift-dot)";

  return (
    <div className="relative">
      {/* rail dot */}
      <span
        className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--background)]"
        style={{ background: dotColor }}
      />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {/* time-since-PR is the prominent figure */}
          <p
            className={`text-sm font-semibold tracking-tight ${
              warm ? "text-[var(--warning)]" : "text-[var(--muted)]"
            }`}
          >
            {fmtAgo(r.daysSince)}
            {warm && <span className="ml-1.5 font-normal text-[var(--muted)]">· due</span>}
            {fresh && <span className="ml-1.5 font-normal text-[var(--muted)]">· just set</span>}
          </p>
          <h3
            className="mt-0.5 truncate text-base font-medium tracking-tight"
            title={r.record.exercise_name}
          >
            {r.record.exercise_name}
          </h3>
          <p className="mt-1 flex items-baseline gap-2 text-sm">
            <span className="font-semibold tabular-nums">
              {fmtWeight(r.record.weight, r.record.unit)} × {r.record.reps}
            </span>
            <span className="text-[var(--faint)] tabular-nums">
              est {fmtNum(r.record.current_estimated_1rm)}
            </span>
            {!fresh && r.gap !== null && (
              <span className="font-medium tabular-nums text-[var(--success)]">
                +{fmtNum(r.gap)}
              </span>
            )}
            {r.isDumbbell && <span className="text-[11px] text-[var(--faint)]">per db</span>}
          </p>
        </div>
        {/* the promoted inline trend */}
        <Spark series={sparkSeries(r, 12)} warm={warm} />
      </div>
    </div>
  );
}

// Inline trend surface — bigger than the dashboard spark, with an area fill,
// so trajectory reads at feed scale.
function Spark({ series, warm }: { series: number[]; warm: boolean }) {
  const w = 84;
  const h = 30;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const coords = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - 2 - ((v - min) / span) * (h - 4);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  const stroke = warm ? "var(--warning)" : "var(--discipline-lift-dot)";
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="mt-1 shrink-0"
      aria-hidden="true"
    >
      <polygon points={area} fill={stroke} opacity={0.08} />
      <polyline
        points={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
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
        Most due at the top — stale PRs whose estimate has climbed since.
      </p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="relative pl-6">
      <div className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--border-strong)]" />
      <div className="flex flex-col gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="relative flex items-start justify-between gap-4">
            <span className="absolute -left-6 top-1.5 h-3.5 w-3.5 animate-pulse rounded-full bg-[var(--surface-2)]" />
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="h-4 w-40 animate-pulse rounded bg-[var(--surface-2)]" />
              <div className="h-3 w-28 animate-pulse rounded bg-[var(--surface-2)]" />
            </div>
            <div className="h-7 w-20 animate-pulse rounded bg-[var(--surface-2)]" />
          </div>
        ))}
      </div>
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
