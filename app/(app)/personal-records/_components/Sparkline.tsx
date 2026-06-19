/**
 * A minimal inline trend spark — a normalized SVG polyline with no axes
 * or labels, sized to sit inside a compact dashboard tile. Renders null
 * for an empty/absent series or a single point (nothing to trend). The
 * stroke color is supplied by the caller so the tile can tie it to the
 * readiness signal (warm when not fresh, calm steel when fresh).
 */
export function Sparkline({
  points,
  color,
  width = 64,
  height = 18,
}: {
  points: number[] | null | undefined;
  color: string;
  width?: number;
  height?: number;
}) {
  if (!points || points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const stepX = width / (points.length - 1);
  const pad = 1;

  const coords = points.map((v, i) => {
    const x = i * stepX;
    const y = pad + (1 - (v - min) / span) * (height - 2 * pad);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={coords.join(" ")}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
