"use client";

/**
 * IDIOM: trend-narrative — draws on Oura's calm "here's where this is heading"
 * trend cards and milestone framing.
 *
 * Organises the surface as the STORY of how the estimate has moved. The trend
 * is the hero — "↑ 11:05 slower" becomes a stated headline, not a caption — the
 * estimate_history reads as a progression/regression arc, and each attempt is an
 * annotated milestone on that arc (the slow long-runs that dragged it; the
 * race-like effort).
 *
 * DIVERGES ON (in-system):
 *  · type scale — editorial: a sentence-as-headline, then a quiet sequential rail.
 *  · color logic — trend DIRECTION is the signal (improving sage / declining
 *    danger), applied calmly — a single tint, never a stoplight.
 *  · spacing rhythm — a vertical timeline; the page reads top-to-bottom in time.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import { estimateTrend, fmtMagnitude, fmtTime, humanizeSource } from "../_shared/format";

export function TrendNarrative({ detail }: { detail: RunningMaxEffortDetail }) {
  const est = detail.estimate;
  const history = detail.estimate_history;
  const trend = estimateTrend(history);

  if (!est || history.length < 2) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center px-8 py-16 text-center">
        <p className="max-w-sm text-lg font-medium tracking-[-0.01em] text-[var(--foreground)]">
          No story yet for the {detail.distance_label}.
        </p>
        <p className="mt-2 max-w-xs text-sm text-[var(--muted)]">
          Log a couple of efforts and we&apos;ll trace where your projection is heading.
        </p>
      </div>
    );
  }

  const startSec = history[0].seconds;
  const startDate = history[0].as_of;
  const tone =
    trend.tone === "positive"
      ? "var(--success)"
      : trend.tone === "negative"
        ? "var(--danger)"
        : "var(--muted)";

  // Headline copy keyed to direction — slower informs without scolding.
  const headline =
    trend.direction === "faster"
      ? "You're trending faster."
      : trend.direction === "slower"
        ? "Your projection has eased off."
        : "Your projection is holding steady.";

  const milestones = detail.attempts
    .slice()
    .sort((a, b) => new Date(a.achieved_at).getTime() - new Date(b.achieved_at).getTime());

  return (
    <div className="px-6 py-7">
      {/* THE trend, stated as a sentence */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">
        {detail.distance_label} · last 6 weeks
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[1.75rem]">
        {headline}
      </h3>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-[var(--muted)]">
        <span
          className="inline-flex items-center gap-1 text-base font-medium"
          style={{ color: tone }}
        >
          <span aria-hidden>{trend.arrow}</span>
          {trend.direction === "flat" ? "no change" : fmtMagnitude(trend.deltaSeconds)}
          {trend.direction === "faster" && " faster"}
          {trend.direction === "slower" && " slower"}
        </span>
        <span className="tabular-nums">
          {fmtTime(startSec)} <span className="text-[var(--faint)]">→</span> {fmtTime(est.seconds)}
        </span>
      </p>

      {/* the arc as a vertical timeline of milestones */}
      <ol className="mt-7 space-y-0">
        <RailNode
          first
          dotColor="var(--faint)"
          date={startDate}
          title="Where it started"
          value={fmtTime(startSec)}
          body="The model's projection six weeks ago."
        />

        {milestones.map((a) => {
          const fasterThanNow = a.duration_seconds < est.seconds;
          return (
            <RailNode
              key={a.activity_id}
              dotColor={fasterThanNow ? "var(--accent-2)" : "var(--muted)"}
              date={a.achieved_at}
              title={`${humanizeSource(a.source)} effort`}
              value={fmtTime(a.duration_seconds)}
              body={
                fasterThanNow
                  ? "Faster than today's projection — proof in the bank the model hasn't caught up to."
                  : a.source === "race_like"
                    ? "A hard but slow race-like effort — recent samples like this pull the fit."
                    : "A sub-maximal long-run that weighed the projection down."
              }
            />
          );
        })}

        <RailNode
          last
          dotColor={tone}
          date={history[history.length - 1].as_of}
          title="Where it stands now"
          value={fmtTime(est.seconds)}
          accentValue
          body={
            detail.actual_best && detail.actual_best.seconds < est.seconds
              ? `Your real best (${fmtTime(detail.actual_best.seconds)}) is still faster — the trend is about the projection, not your ceiling.`
              : trend.direction === "slower"
                ? "A few quicker efforts would pull this back down."
                : "Keep the quick efforts coming and this keeps falling."
          }
        />
      </ol>
    </div>
  );
}

function RailNode({
  date,
  title,
  value,
  body,
  dotColor,
  first,
  last,
  accentValue,
}: {
  date: string;
  title: string;
  value: string;
  body: string;
  dotColor: string;
  first?: boolean;
  last?: boolean;
  accentValue?: boolean;
}) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {/* rail */}
      <div className="relative flex w-3 flex-none justify-center">
        {!first && (
          <span
            className="absolute -top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-[var(--border-strong)]"
            style={{ top: "-1.5rem" }}
          />
        )}
        {!last && (
          <span className="absolute top-3 bottom-[-1.5rem] left-1/2 w-px -translate-x-1/2 bg-[var(--border-strong)]" />
        )}
        <span
          className="relative z-10 mt-1 h-3 w-3 rounded-full ring-4 ring-[var(--background)]"
          style={{ backgroundColor: dotColor }}
        />
      </div>
      {/* content */}
      <div className="flex-1 pt-0.5">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
          <p
            className="text-base font-semibold tabular-nums"
            style={{ color: accentValue ? "var(--accent)" : "var(--foreground)" }}
          >
            {value}
          </p>
        </div>
        <p className="text-[11px] uppercase tracking-wider text-[var(--faint)]">
          {new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-[var(--muted)]">{body}</p>
      </div>
    </li>
  );
}
