/**
 * VARIANT — strava-airy-minimal
 * Idiom: Strava's training calendar. Text-first activity rows (a thin
 * category bar + one line of restrained sans, no boxed pills), hairline
 * cell borders, a 30-day volume sparkline + summary strip up top.
 *
 * - Type scale: tight; hierarchy from WEIGHT, not size (Hanken Grotesk).
 * - Color logic: near-monochrome neutrals + ONE category accent per row
 *   (run = Strava orange, lift = ink, mobility/core = muted slate).
 * - Spacing rhythm: loose, breathable; the month reads calm, not packed.
 *
 * Draws on Strava: text rows, sparkline, low-chrome restraint.
 */
import { MONTH_LABEL, MONTH_STATS, VOLUME_30D, WEEKDAYS, WEEKS, type CalEvent } from "./fixtures";

const INK = "#1b1b1f";
const ORANGE = "#fc4c02"; // Strava
const SLATE = "#8a8f98";

function catColor(e: CalEvent): string {
  if (e.discipline === "run") return ORANGE;
  if (e.discipline === "lift") return INK;
  return SLATE;
}

function metric(e: CalEvent): string {
  if (e.discipline === "run" && e.distanceMi != null) {
    return `${e.distanceMi.toFixed(2)} mi · ${e.pace}/mi`;
  }
  if (e.sets != null) return `${e.sets} sets · ${e.durationMin}m`;
  return e.time;
}

function Sparkline() {
  const max = Math.max(...VOLUME_30D, 1);
  const w = 320;
  const h = 36;
  const step = w / (VOLUME_30D.length - 1);
  const pts = VOLUME_30D.map((v, i) => `${i * step},${h - (v / max) * h}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <polyline points={pts} fill="none" stroke={ORANGE} strokeWidth={1.5} strokeLinejoin="round" />
      {VOLUME_30D.map((v, i) =>
        v > 0 ? (
          <circle key={i} cx={i * step} cy={h - (v / max) * h} r={1.6} fill={ORANGE} />
        ) : null,
      )}
    </svg>
  );
}

function ActivityRow({ e }: { e: CalEvent }) {
  const planned = e.state === "planned";
  return (
    <div className="flex items-stretch gap-2">
      <span
        className="mt-[2px] w-[3px] shrink-0 rounded-full"
        style={{ background: catColor(e), opacity: planned ? 0.4 : 1 }}
      />
      <div className="min-w-0 leading-tight">
        <div
          className="truncate text-[12px] tracking-tight"
          style={{
            color: planned ? SLATE : INK,
            fontWeight: planned ? 500 : 650,
            fontStyle: planned ? "italic" : "normal",
          }}
        >
          {e.fromPlan ? "✓ " : ""}
          {e.name}
        </div>
        <div className="truncate text-[10.5px] font-medium tabular-nums" style={{ color: SLATE }}>
          {planned ? `Planned · ${e.time}` : metric(e)}
        </div>
      </div>
    </div>
  );
}

export default function StravaAiryMinimal() {
  return (
    <div
      className="[font-family:var(--font-hanken)] [font-feature-settings:'ss01']"
      style={{ background: "#fbfbfa", color: INK }}
    >
      <div className="mx-auto max-w-[1180px] px-10 py-12">
        {/* Header — restrained, weight-driven */}
        <header className="mb-10 flex items-end justify-between">
          <div>
            <div
              className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: SLATE }}
            >
              Training Calendar
            </div>
            <h2 className="text-[34px] font-bold leading-none tracking-tight">{MONTH_LABEL}</h2>
          </div>
          <div className="flex items-center gap-3 text-[13px]">
            <button className="rounded-full border border-[#e6e6e3] px-4 py-2 font-semibold transition hover:bg-[#f2f2ef]">
              Today
            </button>
            <button
              className="rounded-full px-4 py-2 font-semibold text-white transition hover:opacity-90"
              style={{ background: ORANGE }}
            >
              Plan a workout
            </button>
          </div>
        </header>

        {/* Summary strip + sparkline, Strava-style */}
        <div className="mb-10 flex flex-wrap items-end justify-between gap-8 border-y border-[#ececea] py-6">
          <div className="flex flex-wrap gap-x-10 gap-y-5">
            {MONTH_STATS.map((s) => (
              <div key={s.label}>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: SLATE }}
                >
                  {s.label}
                </div>
                <div className="text-[19px] font-bold tracking-tight tabular-nums">
                  {s.value}
                  {s.unit ? (
                    <span className="ml-0.5 text-[12px] font-semibold" style={{ color: SLATE }}>
                      {s.unit}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div
              className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: SLATE }}
            >
              30-day volume
            </div>
            <Sparkline />
          </div>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-[repeat(7,1fr)_150px] gap-px">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: SLATE }}
            >
              {d}
            </div>
          ))}
          <div
            className="pb-3 text-right text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: SLATE }}
          >
            Week
          </div>
        </div>

        {/* Grid — hairline borders, airy cells, text rows */}
        <div className="border-t border-[#ececea]">
          {WEEKS.map((week) => (
            <div
              key={week.label}
              className="grid grid-cols-[repeat(7,1fr)_150px] border-b border-[#ececea]"
            >
              {week.days.map((day, i) => (
                <div
                  key={i}
                  className="min-h-[124px] border-l border-[#f2f2ef] px-3 pt-2.5 pb-3 first:border-l-0"
                  style={{ background: day.isToday ? "#fff7f3" : "transparent" }}
                >
                  <div className="mb-2.5 flex items-center gap-1.5">
                    <span
                      className="text-[13px] tabular-nums"
                      style={{
                        color: day.inMonth ? INK : "#cfcfca",
                        fontWeight: day.isToday ? 800 : 600,
                      }}
                    >
                      {day.date}
                    </span>
                    {day.isToday && (
                      <span
                        className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wider text-white"
                        style={{ background: ORANGE }}
                      >
                        Today
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    {day.events.map((e) => (
                      <ActivityRow key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              ))}
              {/* Week summary — quiet, right-aligned, weight for emphasis */}
              <div className="border-l border-[#ececea] bg-[#fafaf8] px-3 pt-2.5 pb-3">
                <div className="text-[11px] font-bold tabular-nums">
                  {week.summary.sessions === 0 ? (
                    <span style={{ color: "#c9c9c4" }}>Rest week</span>
                  ) : (
                    `${week.summary.sessions} ${week.summary.sessions === 1 ? "activity" : "activities"}`
                  )}
                </div>
                <div
                  className="mt-1 space-y-0.5 text-[10.5px] font-medium tabular-nums"
                  style={{ color: SLATE }}
                >
                  {week.summary.liftLabel && <div>Lift {week.summary.liftLabel}</div>}
                  {week.summary.runLabel && <div>Run {week.summary.runLabel}</div>}
                  {week.summary.stepsLabel && <div>{week.summary.stepsLabel} steps</div>}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Day digest — quiet text list */}
        <div className="mt-10">
          <div
            className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
            style={{ color: SLATE }}
          >
            Tuesday, June 16 · 4 planned
          </div>
          <div className="flex flex-col divide-y divide-[#ececea]">
            {WEEKS[2].days[1].events.map((e) => (
              <div key={e.id} className="flex items-center gap-3 py-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: catColor(e), opacity: 0.45 }}
                />
                <span className="text-[14px] font-semibold tracking-tight">{e.name}</span>
                <span
                  className="ml-auto text-[12px] font-medium tabular-nums"
                  style={{ color: SLATE }}
                >
                  Planned · {e.time}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
