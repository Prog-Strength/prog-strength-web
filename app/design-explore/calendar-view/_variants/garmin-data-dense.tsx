/**
 * VARIANT — garmin-data-dense
 * Idiom: Garmin Connect. Information-dense and functional — every activity
 * is a compact bordered card (icon + duration + its key metric) with a
 * category-colored left border, and a persistent "Weekly Totals" rail runs
 * down the right of every week row.
 *
 * - Type scale: small, tight, utilitarian (IBM Plex Sans + Plex Mono nums).
 * - Color logic: strictly category-coded and functional, never decorative
 *   (lift / run / mobility / core each own one hue).
 * - Spacing rhythm: tight, gridded, maximally informative per square inch —
 *   the deliberate opposite of the airy idiom.
 *
 * Draws on Garmin Connect: per-activity metadata density + the Weekly
 * Totals right rail.
 */
import {
  MONTH_LABEL,
  MONTH_STATS,
  WEEKDAYS,
  WEEKS,
  type CalEvent,
  type Discipline,
} from "./fixtures";

const PAGE = "#eef0f3";
const CARD = "#ffffff";
const LINE = "#d3d8df";
const TEXT = "#1f2733";
const SUB = "#69727e";

const CAT: Record<Discipline, { c: string; label: string }> = {
  run: { c: "#0a84d6", label: "RUN" },
  lift: { c: "#7c3aed", label: "STR" },
  mobility: { c: "#0f9d8a", label: "MOB" },
  core: { c: "#e0791b", label: "CORE" },
};

function Icon({ d }: { d: Discipline }) {
  const common = {
    width: 11,
    height: 11,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: CAT[d].c,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (d === "run")
    return (
      <svg {...common}>
        <path d="M13 4a1 1 0 1 0 0-.01M7 21l3-5 3 2 1-4 3 3" />
        <path d="M9 11l3-2 3 1" />
      </svg>
    );
  if (d === "lift")
    return (
      <svg {...common}>
        <path d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10" />
      </svg>
    );
  if (d === "mobility")
    return (
      <svg {...common}>
        <circle cx="12" cy="5" r="2" />
        <path d="M5 10l7-2 7 2M12 8v6l-3 6M12 14l3 6" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function metric(e: CalEvent): string {
  if (e.discipline === "run" && e.distanceMi != null) return `${e.distanceMi.toFixed(2)} mi`;
  if (e.sets != null) return `${e.sets} sets`;
  return "—";
}
function sub(e: CalEvent): string {
  if (e.discipline === "run") return `${e.pace}/mi`;
  if (e.durationMin != null) return `${e.durationMin}:00`;
  return e.time;
}

function ActivityCard({ e }: { e: CalEvent }) {
  const cat = CAT[e.discipline];
  const planned = e.state === "planned";
  return (
    <div
      className="flex items-center gap-1.5 border-l-[3px] bg-white px-1.5 py-1"
      style={{
        borderLeftColor: cat.c,
        boxShadow: "0 1px 0 rgba(31,39,51,0.06)",
        background: planned ? "#f7f9fb" : CARD,
        borderTop: planned ? `1px dashed ${LINE}` : "none",
      }}
    >
      <Icon d={e.discipline} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[10px] font-semibold leading-tight" style={{ color: TEXT }}>
          {e.fromPlan ? "✓ " : ""}
          {e.name}
        </div>
        <div
          className="flex items-center gap-1.5 text-[9px] leading-tight [font-family:var(--font-plex-mono)]"
          style={{ color: SUB }}
        >
          {planned ? (
            <span style={{ color: cat.c }}>◷ {e.time}</span>
          ) : (
            <>
              <span className="font-semibold" style={{ color: cat.c }}>
                {metric(e)}
              </span>
              <span>{sub(e)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GarminDataDense() {
  return (
    <div className="[font-family:var(--font-plex)]" style={{ background: PAGE, color: TEXT }}>
      <div className="mx-auto max-w-[1240px] px-6 py-7">
        {/* Header — functional, with a Week/Month toggle */}
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-[15px]">
              <button className="px-1 text-[var(--accent)]" style={{ color: SUB }}>
                ‹
              </button>
              <h2 className="text-[17px] font-bold tracking-tight">{MONTH_LABEL}</h2>
              <button className="px-1" style={{ color: SUB }}>
                ›
              </button>
            </div>
            <div className="flex overflow-hidden rounded border" style={{ borderColor: LINE }}>
              <button
                className="bg-white px-3 py-1 text-[11px] font-semibold"
                style={{ color: SUB }}
              >
                Week
              </button>
              <button
                className="px-3 py-1 text-[11px] font-bold text-white"
                style={{ background: "#0a84d6" }}
              >
                Month
              </button>
            </div>
          </div>
          <div className="flex gap-2 text-[11px]">
            <button
              className="rounded border bg-white px-3 py-1.5 font-semibold"
              style={{ borderColor: LINE, color: TEXT }}
            >
              Today
            </button>
            <button
              className="rounded px-3 py-1.5 font-bold text-white"
              style={{ background: "#0a84d6" }}
            >
              + Plan a workout
            </button>
          </div>
        </header>

        {/* Hero stat row — dense tiles */}
        <div
          className="mb-4 grid grid-cols-6 overflow-hidden rounded border bg-white"
          style={{ borderColor: LINE }}
        >
          {MONTH_STATS.map((s, i) => (
            <div
              key={s.label}
              className="px-3 py-2"
              style={{ borderLeft: i === 0 ? "none" : `1px solid ${LINE}` }}
            >
              <div
                className="text-[9px] font-semibold uppercase tracking-wide"
                style={{ color: SUB }}
              >
                {s.label}
              </div>
              <div className="text-[16px] font-bold leading-tight [font-family:var(--font-plex-mono)]">
                {s.value}
                {s.unit ? (
                  <span className="ml-0.5 text-[10px]" style={{ color: SUB }}>
                    {s.unit}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-[repeat(7,1fr)_168px] gap-1 px-px">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide"
              style={{ color: SUB }}
            >
              {d}
            </div>
          ))}
          <div
            className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "#0a84d6" }}
          >
            Weekly Totals
          </div>
        </div>

        {/* Grid + persistent right rail */}
        <div className="flex flex-col gap-1">
          {WEEKS.map((week) => (
            <div key={week.label} className="grid grid-cols-[repeat(7,1fr)_168px] gap-1">
              {week.days.map((day, i) => (
                <div
                  key={i}
                  className="flex min-h-[118px] flex-col gap-1 rounded border p-1"
                  style={{
                    borderColor: day.isToday ? "#0a84d6" : LINE,
                    borderWidth: day.isToday ? 2 : 1,
                    background: day.inMonth ? "#fbfcfd" : "#f0f1f3",
                  }}
                >
                  <div className="flex items-center justify-between px-0.5">
                    <span
                      className="text-[11px] font-bold [font-family:var(--font-plex-mono)]"
                      style={{ color: day.inMonth ? TEXT : "#b3bac3" }}
                    >
                      {String(day.date).padStart(2, "0")}
                    </span>
                    {day.events.length > 0 && (
                      <span
                        className="text-[9px] font-semibold [font-family:var(--font-plex-mono)]"
                        style={{ color: SUB }}
                      >
                        {day.events.length}
                      </span>
                    )}
                  </div>
                  {day.events.map((e) => (
                    <ActivityCard key={e.id} e={e} />
                  ))}
                </div>
              ))}
              {/* Weekly Totals rail */}
              <div
                className="flex flex-col justify-center rounded border px-3 py-2"
                style={{
                  borderColor: LINE,
                  background: week.summary.sessions === 0 ? "#f0f1f3" : "#eaf4fc",
                }}
              >
                {week.summary.sessions === 0 ? (
                  <div
                    className="text-center text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "#aab2bc" }}
                  >
                    No activity
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-y-1.5">
                    <TotalCell label="Sessions" value={String(week.summary.sessions)} />
                    {week.summary.runLabel && (
                      <TotalCell label="Distance" value={week.summary.runLabel} />
                    )}
                    {week.summary.liftLabel && (
                      <TotalCell label="Time" value={week.summary.liftLabel} />
                    )}
                    {week.summary.stepsLabel && (
                      <TotalCell label="Steps" value={week.summary.stepsLabel} />
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TotalCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[8.5px] font-semibold uppercase tracking-wide"
        style={{ color: "#5b6470" }}
      >
        {label}
      </div>
      <div
        className="text-[13px] font-bold leading-tight [font-family:var(--font-plex-mono)]"
        style={{ color: "#0a3d62" }}
      >
        {value}
      </div>
    </div>
  );
}
