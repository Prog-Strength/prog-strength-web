"use client";

/**
 * IDIOM: muscle-body-map  ·  draws on Strava's workout muscle heatmap.
 *
 * A front/back anatomical silhouette with the worked regions shaded by set
 * volume on a steel-blue INTENSITY RAMP. The most spatial answer to "what did
 * this train" — and the one that turns the sparse leg day from a liability into
 * a feature: a focused session simply glows at the quads / hamstrings / calves
 * + core, which reads as obviously intentional, never as missing data.
 *
 * DIVERGENCE (within the v0.4 lift steel-blue + tokens — palette/accent/type
 * are NOT re-decided):
 *   - type scale  : minimal — the figure carries the meaning; only a caption of
 *                   the top categories in small muted type.
 *   - color logic : an intensity RAMP — each region's fill opacity scales with
 *                   its share of the heaviest-worked region (unworked = faint
 *                   surface). No second hue.
 *   - spacing     : generous, hero — placed ASIDE the stat line so it reads as
 *                   the session's portrait, leaving the full column below for
 *                   The Work and a future HR trace.
 */

import { RecapShell } from "../_shared";
import {
  populatedMuscles,
  type BodyRegion,
  type RegionMap,
  type WorkoutFixture,
} from "../_fixtures";

export function MuscleBodyMap({ fixture }: { fixture: WorkoutFixture }) {
  return (
    <RecapShell
      fixture={fixture}
      placement="aside"
      graphicLabel="What it trained"
      graphic={<BodyMap regions={fixture.regions} fixture={fixture} />}
    />
  );
}

function BodyMap({ regions, fixture }: { regions: RegionMap; fixture: WorkoutFixture }) {
  const values = Object.values(regions).filter((v): v is number => typeof v === "number" && v > 0);
  const max = values.length ? Math.max(...values) : 0;

  // Degrade: an uncategorizable session shades nothing — a calm empty line, not
  // an empty anatomical frame.
  if (max === 0) {
    return (
      <p className="max-w-[16rem] text-sm leading-relaxed text-[var(--faint)]">
        This session didn&apos;t map to muscle groups.
      </p>
    );
  }

  const top = populatedMuscles(fixture.muscle).slice(0, 3);

  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="flex items-end gap-4">
        <Silhouette regions={regions} max={max} view="front" />
        <Silhouette regions={regions} max={max} view="back" />
      </div>
      <figcaption className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
        {top.map((m) => (
          <span key={m.category}>
            <span className="text-[var(--foreground)]">{m.category}</span>{" "}
            <span className="tabular-nums text-[var(--faint)]">{m.sets}</span>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function Silhouette({
  regions,
  max,
  view,
}: {
  regions: RegionMap;
  max: number;
  view: "front" | "back";
}) {
  const fill = (key: BodyRegion) => {
    const v = regions[key] ?? 0;
    return v > 0 ? "var(--discipline-lift-dot)" : "var(--surface-3)";
  };
  const opacity = (key: BodyRegion) => {
    const v = regions[key] ?? 0;
    return v > 0 ? 0.28 + 0.72 * (v / max) : 1;
  };
  const reg = (key: BodyRegion) => ({
    fill: fill(key),
    fillOpacity: opacity(key),
    stroke: "rgba(255,255,255,0.06)",
    strokeWidth: 1,
  });

  return (
    <svg
      viewBox="0 0 120 250"
      width={108}
      height={225}
      role="img"
      aria-label={`${view} muscle map`}
    >
      {/* neutral head + neck — never shaded */}
      <ellipse cx={60} cy={20} rx={12} ry={14} fill="var(--surface-3)" />
      <rect x={54} y={32} width={12} height={9} rx={3} fill="var(--surface-3)" />

      {view === "front" ? (
        <>
          {/* deltoids */}
          <ellipse cx={37} cy={56} rx={12} ry={9} {...reg("shoulders")} />
          <ellipse cx={83} cy={56} rx={12} ry={9} {...reg("shoulders")} />
          {/* pecs */}
          <path d="M49 56 q-10 2 -10 12 q0 8 11 9 q5 -1 5 -10 l0 -11 z" {...reg("chest")} />
          <path d="M71 56 q10 2 10 12 q0 8 -11 9 q-5 -1 -5 -10 l0 -11 z" {...reg("chest")} />
          {/* biceps */}
          <rect x={24} y={66} width={13} height={30} rx={6} {...reg("biceps")} />
          <rect x={83} y={66} width={13} height={30} rx={6} {...reg("biceps")} />
          {/* abs */}
          <rect x={50} y={78} width={20} height={36} rx={6} {...reg("abs")} />
          {/* quads */}
          <rect x={41} y={120} width={16} height={56} rx={8} {...reg("quads")} />
          <rect x={63} y={120} width={16} height={56} rx={8} {...reg("quads")} />
          {/* shins / calves front */}
          <rect x={43} y={184} width={12} height={46} rx={6} {...reg("calves")} />
          <rect x={65} y={184} width={12} height={46} rx={6} {...reg("calves")} />
        </>
      ) : (
        <>
          {/* traps */}
          <path d="M47 44 q13 -6 26 0 l-4 16 q-9 -4 -18 0 z" {...reg("traps")} />
          {/* rear delts reuse shoulders tone */}
          <ellipse cx={37} cy={58} rx={11} ry={9} {...reg("traps")} />
          <ellipse cx={83} cy={58} rx={11} ry={9} {...reg("traps")} />
          {/* lats */}
          <path d="M48 62 q-12 4 -10 26 q1 8 11 8 l0 -34 z" {...reg("lats")} />
          <path d="M72 62 q12 4 10 26 q-1 8 -11 8 l0 -34 z" {...reg("lats")} />
          {/* triceps */}
          <rect x={24} y={66} width={13} height={30} rx={6} {...reg("triceps")} />
          <rect x={83} y={66} width={13} height={30} rx={6} {...reg("triceps")} />
          {/* lower back */}
          <rect x={51} y={98} width={18} height={20} rx={5} {...reg("lower-back")} />
          {/* glutes */}
          <path d="M50 120 q-9 0 -9 11 q0 9 9 9 q5 0 5 -10 l0 -10 z" {...reg("glutes")} />
          <path d="M70 120 q9 0 9 11 q0 9 -9 9 q-5 0 -5 -10 l0 -10 z" {...reg("glutes")} />
          {/* hamstrings */}
          <rect x={41} y={142} width={16} height={42} rx={8} {...reg("hamstrings")} />
          <rect x={63} y={142} width={16} height={42} rx={8} {...reg("hamstrings")} />
          {/* calves */}
          <rect x={43} y={188} width={12} height={42} rx={6} {...reg("calves")} />
          <rect x={65} y={188} width={12} height={42} rx={6} {...reg("calves")} />
        </>
      )}
      <text
        x={60}
        y={246}
        textAnchor="middle"
        fontSize={8}
        fill="var(--faint)"
        style={{ textTransform: "uppercase", letterSpacing: "0.12em" }}
      >
        {view}
      </text>
    </svg>
  );
}
