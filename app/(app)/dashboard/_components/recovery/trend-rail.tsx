/**
 * RecoveryTrendView — the SECOND view of the HRV tile ("Recovery Trend"), one
 * swipe right of the balance view.
 *
 * Heroes the DIRECTION and deliberately demotes today: one large delta figure —
 * the server 7-day HRV mean (`shortAvg`) against the 30-day baseline (`hrvAvg`),
 * a difference of two server figures, never a re-averaged series — with the
 * trend word beneath and a full-width rail of one mark per night.
 *
 * Two things here are decided elsewhere on purpose, because this view sits on
 * the same tile as the balance view and must not contradict it:
 *
 *   - THE FIGURE'S COLOR is the WEEK's status (`chart.week`), the same value
 *     that colors the balance view's gauge tick. Both are statements about
 *     `shortAvg`, so they are one statement in two places. It is emphatically
 *     NOT last night's status — that verdict is the other view's dot, and
 *     coloring a seven-day figure with a one-night verdict is how a tile ends
 *     up saying "balanced" and "suppressed" about itself in the same breath.
 *   - EACH MARK'S COLOR is `chart.nights`, the server's own per-morning verdict
 *     against that morning's own band. The rail used to re-test every night
 *     against TODAY's bounds, which on a drifting baseline reports a night as
 *     in-band that the chart one swipe away draws as suppressed.
 *
 * A run of ≥3 consecutive suppressed nights reads as a sustained dip and is
 * drawn solid, where an isolated suppressed night is drawn at reduced weight —
 * the same weighting the balance view's dots use, since it comes from the same
 * `nightOpacity`. Above-band nights never escalate: elevated is unusual, not
 * alarming.
 */
"use client";

import { SUSTAINED_DIP_NIGHTS, type HrvChart, type NightMark } from "./hrv-chart";
import { hrvStatusColor, nightColor, nightOpacity, signedUnit, trendLabel } from "./shared";

export function RecoveryTrendView({ chart }: { chart: HrvChart }) {
  const { hrvAvg, shortAvg, week, trend, nights } = chart;
  const { glyph, word } = trendLabel(trend);
  const deltaMs = shortAvg === null ? null : shortAvg - hrvAvg;
  const deltaPct = deltaMs === null ? null : Math.round((deltaMs / hrvAvg) * 100);
  const hasDip = nights.some((n) => n.sustained);

  return (
    <div className="flex flex-col gap-3">
      <div>
        {/* The hero: one big delta figure, about the WEEK. Today is NOT here. */}
        {deltaMs !== null && deltaPct !== null ? (
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-3xl font-semibold tracking-tight tabular-nums"
              style={{ color: week === "unknown" ? "var(--muted)" : hrvStatusColor(week) }}
            >
              {glyph} {Math.abs(deltaPct)}%
            </span>
            <span className="font-mono text-sm tabular-nums text-[var(--muted)]">
              {signedUnit(deltaMs, "ms", 1)}
            </span>
          </div>
        ) : (
          // The band exists (the tile's guard proved it) but the 7-day mean does
          // not yet — a real state, and a different one from calibrating.
          <p className="text-sm text-[var(--muted)]">Not enough nights for a weekly read yet</p>
        )}
        <p className="mt-1 text-xs text-[var(--muted)]">
          7-day HRV {word} · vs 30-day baseline{" "}
          <span className="font-mono tabular-nums">{Math.round(hrvAvg)} ms</span>
        </p>
      </div>

      {/* Full-width rail of night marks — spatial consistency, gaps blank. */}
      <div
        className="flex items-end gap-[2px]"
        role="img"
        aria-label={`${nights.length} nights, each against its own balanced band`}
      >
        {nights.map((mark, i) => (
          <span
            key={i}
            className="h-4 min-w-[2px] flex-1 rounded-[1px]"
            style={{ backgroundColor: nightColor(mark), opacity: nightOpacity(mark) }}
          />
        ))}
      </div>

      <p className="-mt-1 text-[10px] text-[var(--faint)]">
        <Swatch status="balanced" /> balanced
        <span className="mx-1.5">
          <Swatch status="suppressed" /> suppressed
        </span>
        <Swatch status="elevated" /> elevated
        {/* Only claimed when the window actually holds one. */}
        {hasDip && (
          <span className="ml-1.5">
            · solid warning = {SUSTAINED_DIP_NIGHTS}+ nights suppressed
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * A legend chip, painted by the same function that paints the rail — and at the
 * COMMON weight (`sustained: false`), so the suppressed chip matches an ordinary
 * low night rather than the solid one the note below explains.
 */
function Swatch({ status }: { status: NightMark["status"] }) {
  const mark: NightMark = { status, hasReading: true, sustained: false };
  return (
    <span
      aria-hidden="true"
      className="mr-1 inline-block h-1.5 w-1.5 rounded-[1px] align-baseline"
      style={{ backgroundColor: nightColor(mark), opacity: nightOpacity(mark) }}
    />
  );
}
