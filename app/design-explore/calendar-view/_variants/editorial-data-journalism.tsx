/**
 * VARIANT — editorial-data-journalism
 * Idiom: the training month as a DATA STORY — a well-set magazine spread /
 * NYT-graphics piece. Large display heading, oversized high-contrast display
 * numerals for the hero stats, and weekly summaries set as sidebar
 * pull-quotes rather than stat tiles.
 *
 * - Type scale: DRAMATIC. Big-to-small contrast carries the hierarchy
 *   (Fraunces display serif vs Libre Franklin body).
 * - Color logic: a mostly-neutral cream page + ONE editorial accent
 *   (vermillion) used deliberately for emphasis and "done".
 * - Spacing rhythm: columnar, editorial, generous leading; an art-directed
 *   grid rather than a utilitarian one.
 *
 * Draws on Linear's precision + Whoop's confident hero metrics, set as print.
 */
import { MONTH_LABEL, MONTH_STATS, WEEKDAYS, WEEKS, type CalEvent } from "./fixtures";

const PAPER = "#f6f3ea";
const INK = "#181410";
const ACCENT = "#cf3a23"; // editorial vermillion
const FAINT = "#8c8579";
const RULE = "#ddd6c6";

function line(e: CalEvent): string {
  if (e.discipline === "run" && e.distanceMi != null)
    return `${e.distanceMi.toFixed(2)} mi, ${e.pace} pace`;
  if (e.sets != null) return `${e.sets} sets, ${e.durationMin} min`;
  return e.time;
}

function EventLine({ e }: { e: CalEvent }) {
  const done = e.state === "done";
  return (
    <div className="leading-[1.2]">
      <div className="flex items-baseline gap-1.5">
        <span
          className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full"
          style={{
            background: done ? ACCENT : "transparent",
            border: done ? "none" : `1.5px solid ${FAINT}`,
          }}
        />
        <span
          className="text-[11.5px]"
          style={{
            color: INK,
            fontWeight: done ? 600 : 400,
            fontStyle: done ? "normal" : "italic",
          }}
        >
          {e.name}
        </span>
      </div>
      <div
        className="pl-[14px] text-[10px] uppercase tracking-wide [font-family:var(--font-franklin)]"
        style={{ color: FAINT }}
      >
        {done ? line(e) : `Planned · ${e.time}`}
      </div>
    </div>
  );
}

export default function EditorialDataJournalism() {
  const hero = MONTH_STATS[2]; // Run Distance — the lede number
  return (
    <div className="[font-family:var(--font-franklin)]" style={{ background: PAPER, color: INK }}>
      <div className="mx-auto max-w-[1160px] px-12 py-14">
        {/* Masthead */}
        <div
          className="mb-2 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.3em]"
          style={{ color: ACCENT }}
        >
          <span>The Training Month</span>
          <span className="h-px flex-1" style={{ background: RULE }} />
          <span style={{ color: FAINT }}>Vol. VI · No. 6</span>
        </div>
        <h2 className="[font-family:var(--font-fraunces)] text-[64px] font-black leading-[0.92] tracking-[-0.02em]">
          {MONTH_LABEL}
        </h2>
        <p
          className="mt-3 max-w-[640px] text-[13.5px] leading-relaxed [font-family:var(--font-fraunces)] italic"
          style={{ color: "#54504a" }}
        >
          A base block closing strong, a recovery week observed, and a sharp interval week ahead —
          nine sessions logged against a quiet, deliberate back half.
        </p>

        {/* Lede stat band — oversized display numerals */}
        <div
          className="my-10 grid grid-cols-[1.4fr_repeat(5,1fr)] items-end gap-x-6 border-y-2 py-7"
          style={{ borderColor: INK }}
        >
          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.16em]"
              style={{ color: ACCENT }}
            >
              {hero.label}
            </div>
            <div className="[font-family:var(--font-fraunces)] text-[72px] font-black leading-[0.85] tracking-tight">
              {hero.value}
              <span className="text-[24px] font-semibold" style={{ color: FAINT }}>
                {" "}
                {hero.unit}
              </span>
            </div>
          </div>
          {MONTH_STATS.filter((_, i) => i !== 2).map((s) => (
            <div key={s.label} className="border-l pl-5" style={{ borderColor: RULE }}>
              <div
                className="text-[9.5px] font-bold uppercase tracking-[0.12em]"
                style={{ color: FAINT }}
              >
                {s.label}
              </div>
              <div className="[font-family:var(--font-fraunces)] text-[30px] font-bold leading-none tabular-nums">
                {s.value}
                {s.unit ? (
                  <span className="text-[12px] font-semibold" style={{ color: FAINT }}>
                    {" "}
                    {s.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-[repeat(7,1fr)_220px] border-b" style={{ borderColor: INK }}>
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-2 text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ color: FAINT }}
            >
              {d}
            </div>
          ))}
          <div
            className="pb-2 text-right text-[10px] font-bold uppercase tracking-[0.16em]"
            style={{ color: ACCENT }}
          >
            The Week
          </div>
        </div>

        {/* Art-directed grid: hairline rules, big serif day numerals, pull-quote week column */}
        {WEEKS.map((week) => (
          <div
            key={week.label}
            className="grid grid-cols-[repeat(7,1fr)_220px] border-b"
            style={{ borderColor: RULE }}
          >
            {week.days.map((day, i) => (
              <div
                key={i}
                className="min-h-[132px] border-l px-3 py-3 first:border-l-0 first:pl-0"
                style={{ borderColor: RULE }}
              >
                <div className="mb-3 flex items-baseline gap-2">
                  <span
                    className="[font-family:var(--font-fraunces)] text-[26px] font-black leading-none tabular-nums"
                    style={{ color: day.inMonth ? (day.isToday ? ACCENT : INK) : "#cbc4b5" }}
                  >
                    {day.date}
                  </span>
                  {day.isToday && (
                    <span
                      className="text-[9px] font-bold uppercase tracking-[0.16em]"
                      style={{ color: ACCENT }}
                    >
                      Today
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2.5">
                  {day.events.map((e) => (
                    <EventLine key={e.id} e={e} />
                  ))}
                </div>
              </div>
            ))}
            {/* Week as pull-quote sidebar */}
            <div className="border-l py-3 pl-5" style={{ borderColor: INK }}>
              {week.summary.sessions === 0 ? (
                <div
                  className="[font-family:var(--font-fraunces)] text-[15px] italic"
                  style={{ color: "#bdb6a7" }}
                >
                  An open week. Nothing planned, nothing logged.
                </div>
              ) : (
                <>
                  <div className="[font-family:var(--font-fraunces)] text-[34px] font-black leading-none">
                    {week.summary.sessions}
                    <span
                      className="text-[12px] font-semibold uppercase tracking-wide"
                      style={{ color: FAINT }}
                    >
                      {" "}
                      sessions
                    </span>
                  </div>
                  <div
                    className="mt-2 space-y-0.5 text-[11px] leading-snug"
                    style={{ color: "#54504a" }}
                  >
                    {week.summary.liftLabel && (
                      <div>
                        <b className="font-bold">{week.summary.liftLabel}</b> under the bar
                      </div>
                    )}
                    {week.summary.runLabel && (
                      <div>
                        <b className="font-bold">{week.summary.runLabel}</b> on foot
                      </div>
                    )}
                    {week.summary.stepsLabel && (
                      <div>
                        <b className="font-bold">{week.summary.stepsLabel}</b> steps
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Day digest — set as a captioned figure */}
        <div className="mt-10 border-t-2 pt-5" style={{ borderColor: INK }}>
          <div className="[font-family:var(--font-fraunces)] text-[20px] font-bold">
            Tuesday, June 16
          </div>
          <div
            className="mb-4 text-[11px] font-bold uppercase tracking-[0.16em]"
            style={{ color: ACCENT }}
          >
            Four sessions on the slate — the month&apos;s densest day
          </div>
          <div className="grid grid-cols-4 gap-6">
            {WEEKS[2].days[1].events.map((e) => (
              <div key={e.id} className="border-t pt-2" style={{ borderColor: RULE }}>
                <div className="[font-family:var(--font-fraunces)] text-[13px] font-semibold leading-snug">
                  {e.name}
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide" style={{ color: FAINT }}>
                  Planned · {e.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
