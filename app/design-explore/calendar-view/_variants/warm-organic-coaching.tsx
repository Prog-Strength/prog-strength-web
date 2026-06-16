/**
 * VARIANT — warm-organic-coaching
 * Idiom: the human, encouraging end. A warm amber/clay/sand palette on a
 * soft off-white, rounded chips and rounded cells, larger touch targets, a
 * friendly rounded sans — emphasizing consistency and streaks ("you trained
 * 5 of 7 days this week") over raw data density.
 *
 * - Type scale: comfortable, rounded, mid-contrast (Nunito, rounded
 *   terminals).
 * - Color logic: soft TONAL hues per activity type (never saturated
 *   category codes); one warm clay accent carries actions and streaks.
 * - Spacing rhythm: generous and soft, lots of rounded breathing room —
 *   feels like a supportive coach, not a data console.
 *
 * Draws on Whoop: single-accent warmth + confident hero metric and a
 * coaching tone.
 */
import {
  MONTH_LABEL,
  MONTH_STATS,
  WEEKDAYS,
  WEEKS,
  type CalEvent,
  type Discipline,
} from "./fixtures";

const PAGE = "#f7efe4";
const CARD = "#fffaf3";
const INK = "#3b332a";
const SUB = "#9a8d7c";
const CLAY = "#cd6f3e"; // warm accent
const RING = "#ece0cf";

// Soft tonal hues — desaturated, not category-loud.
const TONE: Record<Discipline, { bg: string; fg: string; dot: string }> = {
  run: { bg: "#fbe6da", fg: "#b65a36", dot: "#e08a5e" },
  lift: { bg: "#f6e7c6", fg: "#a07a2c", dot: "#d6ab54" },
  mobility: { bg: "#e2ecdf", fg: "#5d7a5a", dot: "#8aab84" },
  core: { bg: "#f3e0e6", fg: "#a85f74", dot: "#cf8da0" },
};

function chipText(e: CalEvent): string {
  const name = e.name
    .replace(/^(W\d+ D\d+|Week \d+ Workout \d+) - /, "")
    .replace(/^Recovery Week - /, "");
  return name;
}

function Chip({ e }: { e: CalEvent }) {
  const t = TONE[e.discipline];
  const planned = e.state === "planned";
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        background: planned ? "transparent" : t.bg,
        color: planned ? SUB : t.fg,
        border: planned ? `1.5px dashed ${RING}` : "none",
      }}
    >
      <span
        className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] text-white"
        style={{ background: t.dot }}
      >
        {e.state === "done" ? "✓" : planned ? "" : ""}
      </span>
      <span className="truncate">{chipText(e)}</span>
    </div>
  );
}

/** Seven dots, filled for days that carry at least one session. */
function StreakDots({ days }: { days: { events: CalEvent[]; inMonth: boolean }[] }) {
  return (
    <div className="flex items-center gap-1">
      {days.map((d, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{ background: d.events.length > 0 ? CLAY : RING }}
        />
      ))}
    </div>
  );
}

export default function WarmOrganicCoaching() {
  return (
    <div className="[font-family:var(--font-nunito)]" style={{ background: PAGE, color: INK }}>
      <div className="mx-auto max-w-[1180px] px-9 py-12">
        {/* Header — warm + encouraging */}
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-[13px] font-extrabold" style={{ color: CLAY }}>
              Good morning, Jimmy 👋
            </div>
            <h2 className="text-[32px] font-extrabold tracking-tight">{MONTH_LABEL}</h2>
            <p className="mt-1 text-[14px] font-semibold" style={{ color: SUB }}>
              You&apos;ve trained <span style={{ color: INK }}>9 days</span> this month — your
              steadiest block yet. Keep it rolling.
            </p>
          </div>
          <div className="flex gap-2.5 text-[13px] font-bold">
            <button className="rounded-full bg-white px-5 py-2.5 shadow-sm" style={{ color: INK }}>
              Today
            </button>
            <button
              className="rounded-full px-5 py-2.5 text-white shadow-sm"
              style={{ background: CLAY }}
            >
              + Plan a workout
            </button>
          </div>
        </header>

        {/* Hero stats as soft rounded cards */}
        <div className="mb-9 grid grid-cols-3 gap-3 md:grid-cols-6">
          {MONTH_STATS.map((s) => (
            <div
              key={s.label}
              className="rounded-3xl px-4 py-4"
              style={{ background: CARD, boxShadow: "0 2px 10px rgba(120,90,50,0.06)" }}
            >
              <div className="text-[11px] font-bold" style={{ color: SUB }}>
                {s.label}
              </div>
              <div className="mt-0.5 text-[24px] font-extrabold leading-none tracking-tight">
                {s.value}
                {s.unit ? (
                  <span className="ml-0.5 text-[13px] font-bold" style={{ color: SUB }}>
                    {s.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Weekday header */}
        <div className="mb-2 grid grid-cols-7 gap-3 px-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-[12px] font-extrabold" style={{ color: SUB }}>
              {d}
            </div>
          ))}
        </div>

        {/* Each WEEK is a soft rounded panel with a coaching streak strip */}
        <div className="flex flex-col gap-4">
          {WEEKS.map((week) => {
            const trained = week.days.filter((d) =>
              d.events.some((e) => e.state === "done"),
            ).length;
            const inMonthDays = week.days.filter((d) => d.inMonth).length;
            return (
              <div
                key={week.label}
                className="rounded-[28px] p-3"
                style={{ background: CARD, boxShadow: "0 3px 16px rgba(120,90,50,0.07)" }}
              >
                <div className="grid grid-cols-7 gap-3">
                  {week.days.map((day, i) => (
                    <div
                      key={i}
                      className="min-h-[120px] rounded-3xl p-2.5"
                      style={{
                        background: day.isToday
                          ? "#fdf1e6"
                          : day.inMonth
                            ? "#fbf6ee"
                            : "transparent",
                        border: day.isToday
                          ? `2px solid ${CLAY}`
                          : `1.5px solid ${day.inMonth ? RING : "transparent"}`,
                      }}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span
                          className="grid h-7 w-7 place-items-center rounded-full text-[13px] font-extrabold"
                          style={{
                            background: day.isToday ? CLAY : "transparent",
                            color: day.isToday ? "#fff" : day.inMonth ? INK : "#cbbfae",
                          }}
                        >
                          {day.date}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {day.events.map((e) => (
                          <Chip key={e.id} e={e} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Coaching streak strip for the week */}
                <div className="mt-2 flex items-center gap-3 px-2 pt-1.5">
                  <StreakDots days={week.days} />
                  <span
                    className="text-[12.5px] font-bold"
                    style={{ color: trained > 0 ? INK : SUB }}
                  >
                    {week.summary.sessions === 0
                      ? "A rest week — recovery counts too 🌙"
                      : `You trained ${trained} of ${inMonthDays} days`}
                  </span>
                  <span className="ml-auto flex gap-3 text-[12px] font-bold" style={{ color: SUB }}>
                    {week.summary.liftLabel && <span>🏋 {week.summary.liftLabel}</span>}
                    {week.summary.runLabel && <span>🏃 {week.summary.runLabel}</span>}
                    {week.summary.stepsLabel && <span>👟 {week.summary.stepsLabel}</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Day digest — warm card list */}
        <div
          className="mt-9 rounded-[28px] p-6"
          style={{ background: CARD, boxShadow: "0 3px 16px rgba(120,90,50,0.07)" }}
        >
          <div className="mb-1 text-[18px] font-extrabold">Tuesday, June 16</div>
          <div className="mb-4 text-[13px] font-bold" style={{ color: CLAY }}>
            4 sessions planned — your biggest day. You&apos;ve got this 💪
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {WEEKS[2].days[1].events.map((e) => {
              const t = TONE[e.discipline];
              return (
                <div key={e.id} className="rounded-3xl p-4" style={{ background: t.bg }}>
                  <div className="text-[14px] font-extrabold leading-snug" style={{ color: t.fg }}>
                    {chipText(e)}
                  </div>
                  <div className="mt-1 text-[12px] font-bold" style={{ color: t.fg, opacity: 0.7 }}>
                    Planned · {e.time}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
