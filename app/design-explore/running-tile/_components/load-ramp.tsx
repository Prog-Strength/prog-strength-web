/**
 * DX variant — idiom: `load-ramp` · proposed title: `Training Load` · DEFAULT CANDIDATE.
 * THROWAWAY MOCKUP — never promote as-is.
 *
 * Heroes THE DIRECTION and deliberately demotes this week's total. One large
 * signed figure — the current week's TIME ON FEET vs the 4-week baseline —
 * with the plain-language read beneath, over an 8-bucket micro-rail of weekly
 * load with the baseline as a ghost line. Duration, not distance, on purpose:
 * an hour is an hour whether fast or slow, which keeps this orthogonal to
 * stacked-week. Borrows TrainingPeaks' acute-vs-chronic ramp framing and
 * Robinhood's delta-figure headline.
 *
 * The zero-run week is where this variant earns default candidacy: "−100% ·
 * resting · 5 days since your last run" is a true, useful sentence where
 * every other treatment goes quiet.
 *
 * Type scale: the strongest size contrast in the spread — one big delta
 * numeral over a tiny rail, nothing in between. Color logic: STATUS carries
 * the delta and nothing else — success for a steady build, warning above
 * roughly +10%/week, muted for a down week; NEVER danger red (a big week is
 * a choice, not an emergency) — and the rail stays neutral ink.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";
import { formatDuration } from "@/lib/format";
import type { DistanceUnit } from "@/lib/distance-unit-context";
import type { DxRunningFixture } from "./fixtures";

const HREF = "/activities?view=running";
const RAMP_WARNING_PCT = 10; // above ~+10%/week the build is aggressive

export function LoadRampCard({ data }: { data: DxRunningFixture; unit: DistanceUnit }) {
  const { currentWeek: wk, baseline } = data;
  const baseSec = baseline?.durationSeconds ?? null;

  // New runner — no baseline yet. No NaN, no +Infinity%, no chart of nothing.
  if (baseSec === null || baseSec === 0) {
    return (
      <MiniCard title="Training Load" href={HREF}>
        <div className="flex flex-1 flex-col justify-center gap-1 py-1">
          <p className="text-sm font-medium text-[var(--muted)]">
            {wk.durationSeconds > 0 ? (
              <>
                <span className="font-mono tabular-nums text-[var(--foreground)]">
                  {formatDuration(wk.durationSeconds)}
                </span>{" "}
                on feet this week
              </>
            ) : (
              <>No runs logged yet</>
            )}
          </p>
          <p className="text-[11px] text-[var(--faint)]">
            your baseline builds after a few weeks of running
          </p>
        </div>
      </MiniCard>
    );
  }

  const rampPct = Math.round(((wk.durationSeconds - baseSec) / baseSec) * 100);

  // Status carries the delta and nothing else. Never danger red.
  let color: string;
  let word: string;
  if (wk.durationSeconds === 0) {
    color = "var(--muted)";
    word = "resting";
  } else if (rampPct > RAMP_WARNING_PCT) {
    color = "var(--warning)";
    word = "ramping";
  } else if (rampPct >= 0) {
    color = "var(--success)";
    word = "building";
  } else {
    color = "var(--muted)";
    word = "easing";
  }

  // One linear scale across the rail and the ghost baseline line.
  const ceiling = Math.max(...data.weeklyLoad.map((w) => w.durationSeconds), baseSec) * 1.1;
  const hPct = (sec: number) => (ceiling > 0 ? (sec / ceiling) * 100 : 0);

  return (
    <MiniCard title="Training Load" href={HREF}>
      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-3xl font-semibold tracking-tight tabular-nums"
          style={{ color }}
        >
          {rampPct >= 0 ? "+" : "−"}
          {Math.abs(rampPct)}%
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">vs 4-wk load</span>
      </div>

      <p className="text-xs text-[var(--muted)]">
        {word}
        {wk.durationSeconds === 0 && data.daysSinceLastRun !== null ? (
          <> · {data.daysSinceLastRun} days since your last run</>
        ) : (
          <>
            {" "}
            ·{" "}
            <span className="font-mono tabular-nums text-[var(--foreground)]">
              {formatDuration(wk.durationSeconds)}
            </span>{" "}
            vs{" "}
            <span className="font-mono tabular-nums text-[var(--foreground)]">
              {formatDuration(baseSec)}
            </span>{" "}
            avg
          </>
        )}
      </p>

      {/* Eight weeks of time on feet, neutral ink, baseline as a ghost line —
          the down week reads as a deliberate dip, not a hole. */}
      <div
        className="relative h-8 w-full"
        role="img"
        aria-label="Eight weeks of running time against your four-week average"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 border-t border-dashed border-[var(--muted)]/60"
          style={{ bottom: `${hPct(baseSec)}%` }}
        />
        <div className="absolute inset-0 flex items-end gap-[3px]">
          {data.weeklyLoad.map((w, i) => (
            <div
              key={w.weekStart}
              title={`wk of ${w.weekStart} · ${formatDuration(w.durationSeconds)}`}
              className="flex-1 rounded-sm bg-[var(--muted)]"
              style={{
                height: `${Math.max(hPct(w.durationSeconds), 3)}%`,
                opacity: i === data.weeklyLoad.length - 1 ? 0.75 : 0.4,
              }}
            />
          ))}
        </div>
      </div>
    </MiniCard>
  );
}
