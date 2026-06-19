"use client";

/**
 * IDIOM: body-parts-radar  ·  draws on Whoop's single promoted emphasis visual.
 *
 * The six-axis radar of setsByCategory — the flashy "shape of the session,"
 * included so it can be judged head-to-head. It is the option the ticket warns
 * carries the most risk on the focused leg day, so it is built to read as
 * EMPHASIS, not a broken sliver: the full six-axis frame + a faint baseline ring
 * are drawn ALWAYS, the area is filled steel-blue, and the axis labels carry the
 * counts so even a two-axis shape reads as "this session was Legs & Core."
 *
 * DIVERGENCE (within the v0.4 lift steel-blue + tokens):
 *   - type scale  : axis labels are the type — each category + its count ringing
 *                   the chart, populated axes brightened, zero axes dimmed.
 *   - color logic : a translucent steel-blue AREA fill + a solid line + vertex
 *                   dots over an always-drawn faint frame (intensity by area,
 *                   not by hue).
 *   - spacing     : centered and airy — a single square emphasis block with
 *                   breathing room, the strip's old slot promoted to a portrait.
 */

import { RecapShell } from "../_shared";
import { populatedMuscles, type MuscleDatum, type WorkoutFixture } from "../_fixtures";

const SIZE = 240;
const CENTER = SIZE / 2;
const R = 84;

export function BodyPartsRadar({ fixture }: { fixture: WorkoutFixture }) {
  return (
    <RecapShell
      fixture={fixture}
      graphicLabel="The shape of the session"
      graphic={<Radar data={fixture.muscle} />}
    />
  );
}

function axisPoint(index: number, count: number, radius: number) {
  // -90° puts the first axis at 12 o'clock; step clockwise by 360/count.
  const angle = (-90 + (360 / count) * index) * (Math.PI / 180);
  return { x: CENTER + radius * Math.cos(angle), y: CENTER + radius * Math.sin(angle), angle };
}

function Radar({ data }: { data: MuscleDatum[] }) {
  const n = data.length;
  const max = Math.max(...data.map((d) => d.sets), 0);
  const populated = populatedMuscles(data);

  // Degrade: nothing mapped → drop to a calm line, never an empty frame.
  if (max === 0) {
    return (
      <p className="text-sm leading-relaxed text-[var(--faint)]">
        This session didn&apos;t map to muscle groups.
      </p>
    );
  }

  const frame = data.map((_, i) => axisPoint(i, n, R));
  const dataPts = data.map((d, i) => axisPoint(i, n, (d.sets / max) * R));
  const ring = (frac: number) => data.map((_, i) => axisPoint(i, n, R * frac));

  const toPoly = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={236}
        height={236}
        role="img"
        aria-label="muscle radar"
      >
        {/* always-on faint frame + inner rings */}
        {[1, 0.66, 0.33].map((f) => (
          <polygon
            key={f}
            points={toPoly(ring(f))}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        ))}
        {frame.map((p, i) => (
          <line
            key={i}
            x1={CENTER}
            y1={CENTER}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth={1}
          />
        ))}

        {/* the session's area — steel-blue translucent fill + line */}
        <polygon
          points={toPoly(dataPts)}
          fill="var(--discipline-lift-dot)"
          fillOpacity={0.22}
          stroke="var(--discipline-lift-dot)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {dataPts.map((p, i) =>
          data[i].sets > 0 ? (
            <circle key={i} cx={p.x} cy={p.y} r={3.5} fill="var(--discipline-lift-dot)" />
          ) : null,
        )}

        {/* axis labels carry the counts — populated bright, zero dimmed */}
        {data.map((d, i) => {
          const p = axisPoint(i, n, R + 22);
          const lit = d.sets > 0;
          return (
            <text
              key={i}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill={lit ? "var(--discipline-lift-fg)" : "var(--faint)"}
              fontWeight={lit ? 600 : 400}
            >
              {d.category}
              {lit ? ` ${d.sets}` : ""}
            </text>
          );
        })}
      </svg>
      <p className="text-xs text-[var(--muted)]">
        {populated.map((m) => m.category).join(" & ")} — {populated.map((m) => m.sets).join(" · ")}{" "}
        sets
      </p>
    </div>
  );
}
