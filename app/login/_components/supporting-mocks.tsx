import { macroRings, prStat, calendarStreak } from "../_fixtures";

/**
 * Small, on-brand static renders for the nutrition / workouts / calendar
 * feature rows. Lower fidelity than the chat proof on purpose — they're
 * suggestive of the real surfaces, not pixel-faithful, and carry their
 * row's macro/activity tint. All hand-rolled SVG / styled markup: no new
 * deps, no live data.
 */

/** Three macro rings (protein / carbs / fat), intake vs. goal arcs. */
export function MacroRingsMock() {
  return (
    <div className="flex w-full items-center justify-center gap-5 rounded-[var(--radius-card-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-[var(--shadow-soft)]">
      {macroRings.map((ring) => (
        <Ring key={ring.label} {...ring} />
      ))}
    </div>
  );
}

function Ring({
  label,
  intake,
  goal,
  tint,
}: {
  label: string;
  intake: number;
  goal: number;
  tint: string;
}) {
  const size = 76;
  const radius = 32;
  const stroke = 9;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.min(goal > 0 ? intake / goal : 0, 1);
  const pct = goal > 0 ? Math.round((intake / goal) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${pct}% of goal`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tint}
          strokeOpacity={0.2}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          fill={tint}
          className="tabular-nums"
          style={{ fontSize: "15px", fontWeight: 700 }}
        >
          {pct}%
        </text>
      </svg>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
        {label}
      </p>
    </div>
  );
}

/** A single PR / estimated-1RM stat with a "climbing" bar trend. */
export function PrStatMock() {
  const tint = "var(--macro-fat)"; // workouts-amber
  const peak = Math.max(...prStat.recent);

  return (
    <div className="flex w-full flex-col gap-4 rounded-[var(--radius-card-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            {prStat.lift}
          </p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold tabular-nums text-[var(--foreground)]">
              {prStat.estimatedOneRm}
            </span>
            <span className="text-sm font-semibold text-[var(--muted)]">
              {prStat.unit} est. 1RM
            </span>
          </p>
        </div>
        <span
          className="rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold tabular-nums"
          style={{ color: tint, backgroundColor: "var(--macro-fat-bg)" }}
        >
          ▲ {prStat.deltaLb} {prStat.unit}
        </span>
      </div>
      <div className="flex items-end gap-2" aria-hidden="true">
        {prStat.recent.map((w, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md"
            style={{
              height: `${(w / peak) * 56 + 8}px`,
              backgroundColor: tint,
              opacity: 0.35 + (i / (prStat.recent.length - 1)) * 0.65,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** A 4-week training calendar with a streak figure. */
export function CalendarStreakMock() {
  const tint = "var(--macro-carb)"; // calendar-blue

  return (
    <div className="flex w-full flex-col gap-4 rounded-[var(--radius-card-lg)] border border-[var(--border)] bg-[var(--surface)] px-5 py-6 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]">
          Training streak
        </p>
        <span
          className="rounded-[var(--radius-pill)] px-2.5 py-1 text-xs font-bold tabular-nums"
          style={{ color: tint, backgroundColor: "var(--macro-carb-bg)" }}
        >
          🔥 {calendarStreak.streakWeeks} weeks
        </span>
      </div>
      <div className="flex flex-col gap-1.5" aria-hidden="true">
        {calendarStreak.weeks.map((week, wi) => (
          <div key={wi} className="flex gap-1.5">
            {week.map((trained, di) => (
              <div
                key={di}
                className="aspect-square flex-1 rounded-[6px]"
                style={
                  trained
                    ? { backgroundColor: tint, opacity: 0.85 }
                    : { backgroundColor: "var(--surface-3)" }
                }
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
