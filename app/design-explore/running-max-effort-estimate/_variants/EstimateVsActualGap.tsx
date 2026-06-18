"use client";

/**
 * IDIOM: estimate-vs-actual-gap — draws on MacroFactor's predicted-vs-actual.
 *
 * Frames the page around the GAP between projection and reality. A side-by-side
 * "potential vs proof" hero: the projected 53:42 and the actual best 41:35 set
 * against each other, with the signed delta (+12:07) as the centerpiece — the
 * sign and colour carrying whether your proof is ahead of, or behind, your
 * projection. The chart and attempts support beneath.
 *
 * DIVERGES ON (in-system):
 *  · type scale — mid: two balanced hero figures, the delta emphasised by
 *    weight and tone rather than size.
 *  · color logic — the gap is THE encoded thing: a desaturated success tone
 *    when proof is ahead, a calm periwinkle when the projection leads.
 *  · spacing rhythm — a balanced two-column composition bridged at the centre.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import { confidenceLevel, fmtMagnitude, fmtTime, humanizeSource } from "../_shared/format";

export function EstimateVsActualGap({ detail }: { detail: RunningMaxEffortDetail }) {
  const est = detail.estimate;
  const best = detail.actual_best;
  const gap = detail.stats.gap_seconds; // best − estimate; negative = proof faster
  const conf = confidenceLevel(detail.stats.confidence);

  if (!est) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center px-8 py-16 text-center">
        <p className="text-sm text-[var(--muted)]">
          No projection to compare yet — log a few {detail.distance_label} efforts and the
          potential-vs-proof gap appears here.
        </p>
      </div>
    );
  }

  // proofAhead: the runner has already run faster than the projection.
  const proofAhead = gap != null && gap < 0;
  const gapColor = proofAhead ? "var(--success)" : "var(--accent)";

  return (
    <div className="flex flex-col gap-6 px-6 py-8">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
        {/* LEFT — projection (potential) */}
        <Column
          eyebrow="Projection"
          sub="what the model expects today"
          value={fmtTime(est.seconds)}
          range={`${fmtTime(est.lower_seconds)} – ${fmtTime(est.upper_seconds)}`}
          tone="var(--accent)"
          align="right"
        />

        {/* CENTER — the delta, the whole point */}
        <div className="flex flex-col items-center px-1">
          <div className="mb-2 h-8 w-px bg-[var(--border-strong)]" />
          {best && gap != null ? (
            <>
              <span
                className="rounded-full px-3 py-1 text-2xl font-semibold tabular-nums sm:text-3xl"
                style={{
                  color: gapColor,
                  backgroundColor: proofAhead ? "rgba(134,179,159,0.12)" : "var(--accent-soft)",
                }}
              >
                {gap < 0 ? "−" : "+"}
                {fmtMagnitude(gap)}
              </span>
              <p className="mt-2 max-w-[9rem] text-center text-[11px] leading-tight text-[var(--muted)]">
                {proofAhead ? "your proof is faster" : "projection leads your proof"}
              </p>
            </>
          ) : (
            <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-sm text-[var(--faint)]">
              no proof yet
            </span>
          )}
          <div className="mt-2 h-8 w-px bg-[var(--border-strong)]" />
        </div>

        {/* RIGHT — proof (reality) */}
        {best ? (
          <Column
            eyebrow="Your proof"
            sub="fastest you've actually run"
            value={fmtTime(best.seconds)}
            range={new Date(best.achieved_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            tone="var(--accent-2)"
            align="left"
          />
        ) : (
          <div className="flex flex-col items-start">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
              Your proof
            </p>
            <p className="mt-3 text-2xl font-medium text-[var(--faint)]">—</p>
            <p className="mt-2 max-w-[10rem] text-xs text-[var(--muted)]">
              You haven&apos;t logged this distance yet. The projection comes from nearby distances.
            </p>
          </div>
        )}
      </div>

      {/* the honest reading of the weird case */}
      {best && gap != null && (
        <p className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center text-sm text-[var(--muted)]">
          {proofAhead ? (
            <>
              You&apos;ve already run{" "}
              <span className="font-semibold text-[var(--success)]">
                {fmtMagnitude(gap)} faster
              </span>{" "}
              than today&apos;s projection — recent slow long-runs dragged the fit, not your legs.
            </>
          ) : (
            <>
              Your projection sits{" "}
              <span className="font-semibold text-[var(--accent)]">{fmtMagnitude(gap)}</span> ahead
              of your current best — proof that you can run it is what closes the gap.
            </>
          )}
        </p>
      )}

      {/* supporting strip: confidence + the efforts that fed the fit */}
      <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-4">
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>
            {conf.label} confidence · {detail.stats.data_summary}
          </span>
          <span className="text-[var(--faint)]">recent efforts</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {detail.attempts.length === 0 && (
            <span className="text-xs text-[var(--faint)]">No efforts logged at this distance.</span>
          )}
          {detail.attempts.map((a) => (
            <span
              key={a.activity_id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-xs"
            >
              <span className="tabular-nums text-[var(--foreground)]">
                {fmtTime(a.duration_seconds)}
              </span>
              <span className="text-[var(--faint)]">{humanizeSource(a.source)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Column({
  eyebrow,
  sub,
  value,
  range,
  tone,
  align,
}: {
  eyebrow: string;
  sub: string;
  value: string;
  range: string;
  tone: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex flex-col ${align === "right" ? "items-end text-right" : "items-start text-left"}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {eyebrow}
      </p>
      <p
        className="mt-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums sm:text-5xl"
        style={{ color: tone }}
      >
        {value}
      </p>
      <p className="mt-1.5 text-xs tabular-nums text-[var(--muted)]">{range}</p>
      <p className="mt-0.5 text-[11px] text-[var(--faint)]">{sub}</p>
    </div>
  );
}
