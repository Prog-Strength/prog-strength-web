/**
 * Presentational SVG atoms shared by the DX variants: a run route map, a
 * muscle-group radar, and a tiny week bar chart. These are the rich elements
 * the ticket calls out (route map, radar) and they're deliberately
 * color/shape-parameterized so each idiom can restyle them — the divergence
 * is in *how* a variant colors and frames them, not in re-deriving the math.
 */

type Pt = { x: number; y: number };

/** A stylized route map. `rounded` softens corners for the soft idiom. */
export function RouteMap({
  route,
  stroke,
  fill = "none",
  grid,
  width = 360,
  height = 150,
  strokeWidth = 3,
  rounded = false,
  className,
}: {
  route: Pt[];
  stroke: string;
  fill?: string;
  grid?: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
  rounded?: boolean;
  className?: string;
}) {
  const pad = 14;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const pts = route.map((p) => [pad + p.x * w, pad + p.y * h] as const);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const start = pts[0];
  const end = pts[pts.length - 1];
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={className}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {grid && (
        <g stroke={grid} strokeWidth={1} opacity={0.5}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={`h${f}`} x1={0} y1={height * f} x2={width} y2={height * f} />
          ))}
          {[0.2, 0.4, 0.6, 0.8].map((f) => (
            <line key={`v${f}`} x1={width * f} y1={0} x2={width * f} y2={height} />
          ))}
        </g>
      )}
      {fill !== "none" && <path d={`${d} Z`} fill={fill} opacity={0.18} />}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinejoin={rounded ? "round" : "miter"}
        strokeLinecap={rounded ? "round" : "butt"}
      />
      <circle cx={start[0]} cy={start[1]} r={strokeWidth + 2} fill={stroke} />
      <circle
        cx={end[0]}
        cy={end[1]}
        r={strokeWidth + 3}
        fill="#0a0a0a"
        stroke={stroke}
        strokeWidth={2}
      />
    </svg>
  );
}

/** Muscle-group radar polygon. */
export function Radar({
  data,
  stroke,
  fill,
  grid,
  label,
  size = 150,
}: {
  data: { label: string; value: number }[];
  stroke: string;
  fill: string;
  grid: string;
  label?: string;
  size?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 22;
  const n = data.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const point = (i: number, v: number) =>
    [cx + Math.cos(angle(i)) * r * v, cy + Math.sin(angle(i)) * r * v] as const;
  const ring = (v: number) => data.map((_, i) => point(i, v).join(",")).join(" ");
  const poly = data.map((d, i) => point(i, d.value).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-label={label} role="img">
      {[0.33, 0.66, 1].map((v) => (
        <polygon
          key={v}
          points={ring(v)}
          fill="none"
          stroke={grid}
          strokeWidth={1}
          opacity={0.55}
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke={grid} strokeWidth={1} opacity={0.4} />
        );
      })}
      <polygon points={poly} fill={fill} stroke={stroke} strokeWidth={2} />
      {data.map((d, i) => {
        const [x, y] = point(i, 1.18);
        return (
          <text
            key={d.label}
            x={x}
            y={y}
            fill={grid}
            fontSize={8}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{ letterSpacing: 0.2 }}
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

/** A tiny Mon→Sun activity-load bar chart for left-rail "this week" panels. */
export function WeekBars({
  load,
  color,
  track,
  rounded = false,
  height = 44,
}: {
  load: number[];
  color: string;
  track: string;
  rounded?: boolean;
  height?: number;
}) {
  const days = ["M", "T", "W", "T", "F", "S", "S"];
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {load.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="flex w-full items-end"
            style={{ height: height - 14, background: track, borderRadius: rounded ? 6 : 2 }}
          >
            <div
              style={{
                height: `${Math.max(8, v * 100)}%`,
                width: "100%",
                background: color,
                borderRadius: rounded ? 6 : 2,
              }}
            />
          </div>
          <span
            style={{ fontSize: 9, color: track === color ? "#fff" : undefined }}
            className="text-[var(--muted)]"
          >
            {days[i]}
          </span>
        </div>
      ))}
    </div>
  );
}
