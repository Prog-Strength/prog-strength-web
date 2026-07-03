/**
 * Variant: progress-meter  (idiom 4 of 5)
 *
 * Heroes GOAL ATTAINMENT AS A SHAPE — a tile-scale shrink of the deep Steps
 * page's selected `goal-ring-hero`, so the tile previews the page it links
 * into. Draws on Apple Fitness rings. The most visceral "how close am I to
 * goal" answer.
 *
 * - Type scale:   the ring's centre number is the size anchor; everything
 *                 else (the %, the captions) is small.
 * - Color logic:  the accent fills the ring's progress, flipping to success
 *                 once at/over goal (the ring crests past 100%). Muted grey is
 *                 the untravelled track. No new hue.
 * - Spacing:      centred, compact around the shape, with a 7-bar sparkbar
 *                 beneath as supporting texture and `avg · goal` captions.
 *
 * With no goal the ring degrades to a neutral outline (no fill, no NaN%) and
 * a "set a goal" affordance — the ring shape stays, its meaning steps back.
 */

import { compact } from "../../../(app)/dashboard/_components/compact";
import type { StepsFixture } from "../_fixtures";

const MET = "#86b39f";
const UNDER = "#5b6168";
const R = 30; // ring radius (px)
const STROKE = 6;
const C = 2 * Math.PI * R;

export function ProgressMeter({ fixture }: { fixture: StepsFixture }) {
  const { view } = fixture;
  const { today, avg, goal, spark } = view;

  const hasGoal = goal !== null;
  const pct = hasGoal ? today / goal : 0;
  const cleared = hasGoal && pct >= 1;
  const fillFrac = Math.min(pct, 1);
  const ringColor = !hasGoal ? "var(--faint)" : cleared ? MET : "var(--accent)";
  const barCeiling = Math.max(...spark, goal ?? 0) || 1;

  const size = (R + STROKE) * 2;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={R}
            fill="none"
            stroke="var(--surface-3)"
            strokeWidth={STROKE}
          />
          {hasGoal && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={R}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fillFrac)}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-lg font-semibold leading-none tracking-tight tabular-nums text-[var(--foreground)]">
            {compact(today)}
          </span>
          {hasGoal ? (
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: cleared ? MET : "var(--muted)" }}
            >
              {Math.round(pct * 100)}%
            </span>
          ) : (
            <span className="text-[10px] font-medium text-[var(--muted)]">today</span>
          )}
        </div>
      </div>

      {/* supporting texture — the week as a quiet 7-bar sparkbar */}
      <div className="flex h-6 w-full items-end justify-between gap-[3px]">
        {spark.map((v, i) => {
          const isToday = i === spark.length - 1;
          const met = hasGoal && v >= goal;
          const color = isToday ? ringColor : hasGoal ? (met ? MET : UNDER) : UNDER;
          return (
            <div
              key={i}
              className="flex-1 rounded-[1px]"
              style={{
                height: Math.max((v / barCeiling) * 24, v > 0 ? 2 : 0),
                backgroundColor: color,
                opacity: isToday ? 1 : 0.6,
              }}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">avg</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(avg)}</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">goal</span>
          {hasGoal ? (
            <span className="font-mono tabular-nums text-[var(--foreground)]">{compact(goal)}</span>
          ) : (
            <span className="text-[var(--accent)]">set a goal</span>
          )}
        </span>
      </div>
    </div>
  );
}
