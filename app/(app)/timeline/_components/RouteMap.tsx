import type { TimelineRoute } from "@/lib/api";

/**
 * The run card's map slot. Today this renders a graceful, on-brand "no route
 * yet" placeholder — a muted slate map-frame motif at the eventual map's 16:9
 * aspect, so the card layout is already correct before geometry exists. It
 * accepts the FUTURE `content.route` shape (TimelineRoute) and, when present,
 * draws a lightweight static SVG polyline. No tiles, no dependencies: when
 * run-route-geometry-capture lands, lighting up real routes is a prop wiring
 * change, not a card rework. See prog-strength-docs/sows/timeline-redesign.md.
 */
const VIEW = 100;

/** Project lat/lng points into a [w×h] viewbox, flipping latitude (north up). */
export function projectRoute(
  route: TimelineRoute,
  w: number,
  h: number,
): { x: number; y: number }[] {
  const { min_lat, min_lng, max_lat, max_lng } = route.bounds;
  const dLat = max_lat - min_lat || 1;
  const dLng = max_lng - min_lng || 1;
  return route.points.map(([lat, lng]) => ({
    x: ((lng - min_lng) / dLng) * w,
    y: h - ((lat - min_lat) / dLat) * h,
  }));
}

export function RouteMap({ route }: { route?: TimelineRoute | null }) {
  const hasRoute = !!route && route.points.length >= 2;
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]">
      <div className="aspect-[16/9] w-full">
        {hasRoute ? <Polyline route={route!} /> : <Placeholder />}
      </div>
    </div>
  );
}

function Polyline({ route }: { route: TimelineRoute }) {
  const pts = projectRoute(route, VIEW, VIEW);
  const d = pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  return (
    <svg
      data-testid="route-polyline"
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      aria-label="Run route"
    >
      <path
        d={d}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Placeholder() {
  return (
    <div
      data-testid="route-placeholder"
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2)_10px,var(--surface-3)_10px,var(--surface-3)_20px)]"
    >
      <MapFrameGlyph />
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--faint)]">
        Route map coming soon
      </span>
    </div>
  );
}

function MapFrameGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={28}
      height={28}
      fill="none"
      stroke="var(--faint)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 4 4 6v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  );
}
