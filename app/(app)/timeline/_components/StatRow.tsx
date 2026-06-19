import { parseStats } from "./parseStats";

/**
 * The card's labeled big-value stat row: each metric from the API's
 * pre-formatted `content.metrics` is shown as a bold condensed numeral with a
 * small uppercase unit beneath it — the athletic "big stat" treatment. Parses
 * with parseStats; renders nothing when there are no stats.
 */
export function StatRow({ metrics }: { metrics: string[] }) {
  const stats = parseStats(metrics);
  if (stats.length === 0) return null;
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-3">
      {stats.map((s, i) => (
        <div key={i} className="flex flex-col">
          <dd className="text-2xl font-bold leading-none text-[var(--foreground)] tabular-nums">
            {s.value}
          </dd>
          {s.label && (
            <dt className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              {s.label}
            </dt>
          )}
        </div>
      ))}
    </dl>
  );
}
