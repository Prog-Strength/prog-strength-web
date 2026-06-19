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
 */

const VIEW_W = 100;
const VIEW_H = 28;
const PAD_Y = 3; // keep the stroke off the top/bottom edges

export function Spark({
  points,
  className,
  accent,
}: {
  points: number[];
  className?: string;
  accent?: string;
}) {
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

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min;
  const usableH = VIEW_H - PAD_Y * 2;
  const stepX = VIEW_W / (points.length - 1);

  const coords = points.map((value, i) => {
    const x = i * stepX;
    // Flat series (span 0) → pin to the vertical middle so it reads as a
    // calm baseline rather than collapsing to the top or bottom edge.
    const ratio = span === 0 ? 0.5 : (value - min) / span;
    // SVG y grows downward; invert so larger values sit higher.
    const y = PAD_Y + (1 - ratio) * usableH;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke={accent ?? "currentColor"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
