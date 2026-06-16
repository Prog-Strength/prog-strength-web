/**
 * VARIANT — terminal-dense-mono
 * Idiom: a developer-terminal aesthetic (the Linear / command-line end).
 * Monospace throughout; session state shown with STATUS GLYPHS (✓ done,
 * ○ planned, ⟳ recurring) instead of colored pills; ASCII-flavored rules.
 *
 * - Type scale: uniform — size never changes; hierarchy comes from weight,
 *   glyphs, and indentation (JetBrains Mono everywhere).
 * - Color logic: a single phosphor accent on an otherwise neutral dark
 *   field; state is encoded by glyph, not hue.
 * - Spacing rhythm: dense, uniform, monospaced cadence, zero decoration —
 *   maximum signal, minimum chrome.
 *
 * Draws on Linear: crisp typographic hierarchy, single-accent palette,
 * keyboard-first density.
 */
import { MONTH_LABEL, MONTH_STATS, WEEKDAYS, WEEKS, type CalEvent } from "./fixtures";

const BG = "#0b0e11";
const PANEL = "#11151a";
const LINE = "#1f262e";
const TEXT = "#c7d0d9";
const DIM = "#5c6773";
const ACCENT = "#5ce39a"; // single phosphor accent

function glyph(e: CalEvent): { g: string; color: string } {
  if (e.recurring && e.state === "planned") return { g: "⟳", color: ACCENT };
  if (e.state === "done") return { g: "✓", color: ACCENT };
  return { g: "○", color: DIM };
}

function tag(e: CalEvent): string {
  return e.discipline === "run"
    ? "run "
    : e.discipline === "lift"
      ? "lift"
      : e.discipline === "core"
        ? "core"
        : "mob ";
}

function meta(e: CalEvent): string {
  if (e.discipline === "run" && e.distanceMi != null)
    return `${e.distanceMi.toFixed(2)}mi ${e.pace}`;
  if (e.sets != null) return `${e.sets}x ${e.durationMin}m`;
  return e.time.replace(" ", "").toLowerCase();
}

function EventRow({ e }: { e: CalEvent }) {
  const { g, color } = glyph(e);
  const planned = e.state === "planned";
  return (
    <div className="flex items-center gap-1 whitespace-nowrap text-[10.5px] leading-[1.45]">
      <span style={{ color }}>{g}</span>
      <span style={{ color: DIM }}>{tag(e)}</span>
      <span
        className="truncate"
        style={{ color: planned ? DIM : TEXT, fontWeight: planned ? 400 : 600 }}
      >
        {e.name.replace(/^(W\d+ D\d+|Week \d+ Workout \d+) - /, "")}
      </span>
      <span className="ml-auto pl-1 tabular-nums" style={{ color: DIM }}>
        {meta(e)}
      </span>
    </div>
  );
}

export default function TerminalDenseMono() {
  return (
    <div
      className="[font-family:var(--font-jetbrains)] text-[12px]"
      style={{ background: BG, color: TEXT }}
    >
      <div className="mx-auto max-w-[1180px] px-6 py-8">
        {/* Prompt-style header */}
        <div className="mb-3 flex items-center gap-2 text-[12px]">
          <span style={{ color: ACCENT }}>~/training</span>
          <span style={{ color: DIM }}>$</span>
          <span style={{ color: TEXT }}>cal --month 2026-06</span>
          <span className="ml-auto" style={{ color: DIM }}>
            [ Today ] [ + plan ] &nbsp;‹ {MONTH_LABEL} ›
          </span>
        </div>

        {/* Stat row as a key=value strip */}
        <div className="mb-1 px-1 text-[10.5px]" style={{ color: DIM }}>
          ┌─ month summary
          ────────────────────────────────────────────────────────────────────────────┐
        </div>
        <div className="mb-1 flex flex-wrap gap-x-6 gap-y-1 px-3 text-[11px]">
          {MONTH_STATS.map((s) => (
            <span key={s.label} className="tabular-nums">
              <span style={{ color: DIM }}>{s.label.toLowerCase().replace(" ", "_")}=</span>
              <span style={{ color: ACCENT, fontWeight: 600 }}>
                {s.value}
                {s.unit ?? ""}
              </span>
            </span>
          ))}
        </div>
        <div className="mb-4 px-1 text-[10.5px]" style={{ color: DIM }}>
          └────────────────────────────────────────────────────────────────────────────────────────────┘
        </div>

        {/* Grid header */}
        <div
          className="grid grid-cols-[repeat(7,1fr)_150px] border-b text-[10px]"
          style={{ borderColor: LINE }}
        >
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-1 font-semibold uppercase tracking-widest"
              style={{ color: DIM }}
            >
              {d.toLowerCase()}
            </div>
          ))}
          <div
            className="px-2 py-1 text-right font-semibold uppercase tracking-widest"
            style={{ color: ACCENT }}
          >
            wk
          </div>
        </div>

        {/* Grid — uniform mono cells */}
        <div style={{ borderLeft: `1px solid ${LINE}` }}>
          {WEEKS.map((week) => (
            <div
              key={week.label}
              className="grid grid-cols-[repeat(7,1fr)_150px]"
              style={{ borderBottom: `1px solid ${LINE}` }}
            >
              {week.days.map((day, i) => (
                <div
                  key={i}
                  className="min-h-[112px] px-2 py-1.5"
                  style={{
                    borderRight: `1px solid ${LINE}`,
                    background: day.isToday
                      ? "rgba(92,227,154,0.06)"
                      : day.inMonth
                        ? "transparent"
                        : PANEL,
                  }}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className="tabular-nums text-[12px]"
                      style={{
                        color: day.inMonth ? TEXT : DIM,
                        fontWeight: day.isToday ? 700 : 500,
                      }}
                    >
                      {String(day.date).padStart(2, "0")}
                    </span>
                    {day.isToday ? (
                      <span className="text-[9px]" style={{ color: ACCENT }}>
                        ◀ now
                      </span>
                    ) : day.events.length > 0 ? (
                      <span className="text-[9px]" style={{ color: DIM }}>
                        {day.events.length}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-col">
                    {day.events.map((e) => (
                      <EventRow key={e.id} e={e} />
                    ))}
                  </div>
                </div>
              ))}
              {/* Week column — key=value */}
              <div className="px-2 py-1.5 text-[10px]" style={{ background: PANEL }}>
                {week.summary.sessions === 0 ? (
                  <div style={{ color: DIM }}>· empty ·</div>
                ) : (
                  <div className="flex flex-col gap-0.5 tabular-nums">
                    <div>
                      <span style={{ color: DIM }}>n=</span>
                      <span style={{ color: ACCENT, fontWeight: 600 }}>
                        {week.summary.sessions}
                      </span>
                    </div>
                    {week.summary.liftLabel && (
                      <div style={{ color: TEXT }}>lift {week.summary.liftLabel}</div>
                    )}
                    {week.summary.runLabel && (
                      <div style={{ color: TEXT }}>run {week.summary.runLabel}</div>
                    )}
                    {week.summary.stepsLabel && (
                      <div style={{ color: DIM }}>{week.summary.stepsLabel} st</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Legend + keyboard hints */}
        <div
          className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10.5px]"
          style={{ color: DIM }}
        >
          <span>
            <span style={{ color: ACCENT }}>✓</span> done
          </span>
          <span>
            <span style={{ color: ACCENT }}>○</span> planned
          </span>
          <span>
            <span style={{ color: ACCENT }}>⟳</span> recurring
          </span>
          <span className="ml-auto">j/k day · h/l week · ↵ open · g today</span>
        </div>

        {/* Day digest — terminal listing */}
        <div
          className="mt-5 rounded border p-3 text-[11px]"
          style={{ borderColor: LINE, background: PANEL }}
        >
          <div className="mb-2" style={{ color: DIM }}>
            $ cal show 2026-06-16 <span style={{ color: TEXT }}># Tue · 4 planned</span>
          </div>
          {WEEKS[2].days[1].events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 tabular-nums leading-relaxed">
              <span style={{ color: e.recurring ? ACCENT : DIM }}>{e.recurring ? "⟳" : "○"}</span>
              <span style={{ color: DIM }}>{e.time.replace(" ", "").toLowerCase().padEnd(7)}</span>
              <span style={{ color: DIM }}>[{tag(e).trim()}]</span>
              <span style={{ color: TEXT }}>{e.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
