const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * A compact seven-bar sparkline of this week's activity counts (Monday→
 * Sunday), for the timeline left rail. Pure presentational: the heights
 * scale to the busiest day, the "today" column is accent-tinted, and the
 * whole strip carries one aria-label so it reads as a single graphic.
 */
export function WeekBars({ bars, todayIndex }: { bars: number[]; todayIndex: number }) {
  const max = Math.max(1, ...bars);
  const total = bars.reduce((s, n) => s + n, 0);
  return (
    <div
      role="img"
      aria-label={`This week: ${total} ${total === 1 ? "activity" : "activities"}`}
      className="flex items-end gap-1.5"
    >
      {bars.map((n, i) => {
        const isToday = i === todayIndex;
        const heightPct = Math.round((n / max) * 100);
        return (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-12 w-full items-end">
              <div
                data-testid="week-bar"
                data-today={isToday ? "true" : undefined}
                style={{ height: `${Math.max(n > 0 ? 12 : 3, heightPct)}%` }}
                className={`w-full rounded-full ${
                  n > 0
                    ? isToday
                      ? "bg-[var(--accent)]"
                      : "bg-[var(--accent-line)]"
                    : "bg-[var(--surface-3)]"
                }`}
              />
            </div>
            <span
              className={`text-[10px] font-semibold ${
                isToday ? "text-[var(--accent)]" : "text-[var(--faint)]"
              }`}
            >
              {DAY_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
