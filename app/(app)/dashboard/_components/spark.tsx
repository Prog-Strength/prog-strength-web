/**
 * Spark — a small inline SVG sparkline, hand-rolled (no chart lib).
 *
 * Plots a `number[]` as a single <polyline> inside a fixed 100×28 viewBox
 * that scales to the parent via width/height 100%. The series is normalized
 * to its own min/max so the line fills the vertical space regardless of the
 * absolute magnitudes. Degenerate inputs render calmly:
 *   - 0 or 1 point → nothing (no line to draw)
 *   - an all-equal series (flat) → a centered horizontal line
 *
 * The stroke colour comes from `currentColor` by default so callers tint it
 * by setting a text colour (e.g. a discipline-dot token); pass `accent` to
 * override with an explicit token/colour.
 *
 * Optional dual series: pass `points2` (+ optional `accent2`) to draw a
 * SECOND polyline. When present, BOTH series are normalized against a shared
 * min/max (the combined extent across both arrays) so the two lines sit on
 * one comparable vertical scale rather than each filling the box on its own.
 * The single-series path is unchanged when `points2` is absent.
 */

const VIEW_W = 100;
const VIEW_H = 28;
const PAD_Y = 3; // keep the stroke off the top/bottom edges

/** Map a series to a `points` string on the given [min,max] scale. */
function toCoords(points: number[], min: number, max: number): string {
  const span = max - min;
  const usableH = VIEW_H - PAD_Y * 2;
  const stepX = VIEW_W / (points.length - 1);
  return points
    .map((value, i) => {
      const x = i * stepX;
      // Flat span → pin to the vertical middle so it reads as a calm baseline
      // rather than collapsing to the top or bottom edge.
      const ratio = span === 0 ? 0.5 : (value - min) / span;
      // SVG y grows downward; invert so larger values sit higher.
      const y = PAD_Y + (1 - ratio) * usableH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function Spark({
  points,
  points2,
  className,
  accent,
  accent2,
}: {
  points: number[];
  points2?: number[];
  className?: string;
  accent?: string;
  accent2?: string;
}) {
  const hasSecond = !!points2 && points2.length >= 2;
  // Need at least two points to draw a line.
  if (!points || points.length < 2) {
    return (
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className={className}
        aria-hidden="true"
      />
    );
  }

  // Shared scale: when a second series is drawn, both normalize against the
  // combined extent so the two lines are directly comparable.
  const scaleValues = hasSecond ? [...points, ...points2!] : points;
  const min = Math.min(...scaleValues);
  const max = Math.max(...scaleValues);

  const coords = toCoords(points, min, max);
  const coords2 = hasSecond ? toCoords(points2!, min, max) : null;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={coords}
        fill="none"
        stroke={accent ?? "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {coords2 !== null && (
        <polyline
          points={coords2}
          fill="none"
          stroke={accent2 ?? "currentColor"}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}
