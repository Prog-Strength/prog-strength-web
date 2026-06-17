/**
 * VARIANT 2 / 4 — idiom: week-band-rows
 * ------------------------------------------------------------------
 * "What exists now, finally polished." Evolves the current horizontal
 * week-band structure rather than replacing it, executed with discipline and
 * the coaching warmth the design system endorses (Whoop's tone, re-toned to
 * slate/violet). Each week is a generous band of seven day cards plus a
 * first-class per-week coaching strip — the "● ● ● ○ ○ ● ● you trained 5 of 7"
 * dots and totals become a real summary element. Only the current month's weeks.
 *
 *   • Type scale   — larger, comfortable; the day cards breathe.
 *   • Color logic  — violet carries the streak/progress dots and the selected
 *                    week's ring; activity hues stay desaturated.
 *   • Spacing      — airy, vertical; one week per band with real separation.
 *   • Navigation   — large prev/next affordances on the band stack; the month
 *                    title is a section header, not a utility bar.
 *   • Day detail   — the selected day's digest sits directly under its band.
 *   • Modals       — roomy, coaching-toned (scoped to this frame in the mockup).
 *
 * In-system: slate ramp + violet accent + Nunito only. Diverges on composition.
 * THROWAWAY DX mockup — static fixtures, no data services.
 */
"use client";

import { useState } from "react";
import {
  MONTH_WEEKS,
  WEEK_STATS,
  WEEKDAY_LABELS,
  eventsByDate,
  HUE,
  TODAY_ISO,
  WORKED_EVENT_ID,
  WORKED_AGENDA,
  disciplineLabel,
  type CalEvent,
  type WeekStat,
} from "./fixtures";
import {
  ChevronLeft,
  ChevronRight,
  ClockGlyph,
  DisciplineGlyph,
  StateGlyph,
  CheckGlyph,
  PlusGlyph,
  CloseGlyph,
  PlayGlyph,
  PencilGlyph,
  GoogleGlyph,
} from "./icons";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function BandPill({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const hue = HUE[ev.discipline];
  const planned = ev.state === "planned";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${ev.time} · ${ev.title}`}
      className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition-transform hover:scale-[1.015]"
      style={{
        background: planned ? "transparent" : hue.bg,
        border: `1.5px ${planned ? "dashed" : "solid"} ${hue.line}`,
      }}
    >
      <span style={{ color: hue.fg }}>
        <StateGlyph d={ev.discipline} state={ev.state} s={13} />
      </span>
      <span className="truncate text-[11px] font-extrabold" style={{ color: "var(--foreground)" }}>
        {ev.title.replace(/^Recovery Week — /, "")}
      </span>
    </button>
  );
}

function CoachStrip({ stat }: { stat: WeekStat }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5">
        {stat.dots.map((on, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full"
            style={
              on ? { background: "var(--accent)" } : { border: "1.5px solid var(--border-strong)" }
            }
          />
        ))}
      </div>
      <span className="text-[12px] font-extrabold">
        You trained <span style={{ color: "var(--accent)" }}>{stat.trained}</span> of 7 days
      </span>
      <span className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>
        lift {stat.lift} · run <span style={{ color: HUE.run.fg }}>{stat.run}</span>
        {stat.steps ? ` · ${stat.steps} steps` : ""}
      </span>
      {stat.note && (
        <span className="text-[11px] font-semibold italic" style={{ color: "var(--faint)" }}>
          {stat.note}
        </span>
      )}
    </div>
  );
}

export function VariantWeekBandRows() {
  const [selected, setSelected] = useState(TODAY_ISO);
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [editing, setEditing] = useState(false);
  const dayEvents = eventsByDate(selected);

  return (
    <div className="relative flex flex-col gap-5" style={{ color: "var(--foreground)" }}>
      {/* Section header — title as heading, large nav affordances */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[22px] font-extrabold leading-none">June 2026</h3>
          <div className="flex items-center gap-1.5">
            <button
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
              aria-label="Previous month"
            >
              <ChevronLeft s={17} />
            </button>
            <button
              className="grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--surface-2)]"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
              aria-label="Next month"
            >
              <ChevronRight s={17} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full px-3.5 py-2 text-[12px] font-bold"
            style={{ background: "var(--surface-2)", color: "var(--muted)" }}
          >
            Today
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <PlusGlyph s={14} /> Plan a workout
          </button>
        </div>
      </div>
      <p className="-mt-3 text-[12.5px] font-semibold" style={{ color: "var(--muted)" }}>
        Nice work, Jimmy — you&apos;ve trained 9 days this month.
      </p>

      {/* Week bands */}
      <div className="flex flex-col gap-4">
        {MONTH_WEEKS.map((week, wi) => {
          const stat = WEEK_STATS[wi];
          const weekHasSelected = week.some((c) => c.iso === selected);
          const recovery = stat.note?.startsWith("Recovery");
          return (
            <div key={wi}>
              <div
                className="rounded-2xl p-3.5"
                style={{
                  background: "var(--surface)",
                  border: weekHasSelected
                    ? "1px solid var(--accent-line)"
                    : "1px solid var(--border)",
                  boxShadow: weekHasSelected ? "0 0 0 1px var(--accent-line)" : undefined,
                }}
              >
                {/* coaching strip — first class */}
                <div className="mb-3 flex items-center justify-between gap-3">
                  <CoachStrip stat={stat} />
                  {recovery && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-bold uppercase tracking-wide"
                      style={{ background: "var(--surface-3)", color: "var(--muted)" }}
                    >
                      Recovery week
                    </span>
                  )}
                </div>

                {/* seven day cards */}
                <div className="grid grid-cols-7 gap-2">
                  {week.map((cell) => {
                    const evs = eventsByDate(cell.iso);
                    const isSel = cell.iso === selected;
                    return (
                      <div
                        key={cell.iso}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelected(cell.iso)}
                        className="flex min-h-[104px] cursor-pointer flex-col gap-1.5 rounded-xl p-2 text-left transition-colors"
                        style={{
                          background: cell.isToday
                            ? "var(--accent-soft)"
                            : cell.inMonth
                              ? "var(--surface-2)"
                              : "transparent",
                          border: cell.isToday
                            ? "1px solid var(--accent-line)"
                            : isSel
                              ? "1px solid var(--border-strong)"
                              : "1px solid transparent",
                          opacity: cell.inMonth ? 1 : 0.4,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[9.5px] font-bold uppercase"
                            style={{ color: "var(--faint)" }}
                          >
                            {WEEKDAY_LABELS[week.indexOf(cell)]}
                          </span>
                          <span
                            className="grid h-5 w-5 place-items-center rounded-full text-[12px] font-extrabold tabular-nums"
                            style={
                              cell.isToday
                                ? { background: "var(--accent)", color: "var(--accent-fg)" }
                                : { color: cell.inMonth ? "var(--foreground)" : "var(--faint)" }
                            }
                          >
                            {cell.dayNum}
                          </span>
                        </div>
                        <div className="flex flex-1 flex-col gap-1">
                          {evs.map((ev) => (
                            <BandPill key={ev.id} ev={ev} onClick={() => setOpenEvent(ev)} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* day digest sits directly under its band */}
              {weekHasSelected && (
                <div
                  className="mx-3 mt-2 rounded-2xl p-3.5"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
                >
                  <div className="mb-2.5 flex items-baseline justify-between">
                    <div className="text-[14px] font-extrabold">{fmtDate(selected)}</div>
                    <div className="text-[11px] font-semibold" style={{ color: "var(--faint)" }}>
                      {dayEvents.length} {dayEvents.length === 1 ? "activity" : "activities"}
                    </div>
                  </div>
                  {dayEvents.length === 0 ? (
                    <div
                      className="rounded-xl px-3 py-5 text-center text-[12px] font-semibold"
                      style={{ color: "var(--faint)" }}
                    >
                      Rest day. Recovery counts too — you&apos;re right on plan.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {dayEvents.map((ev) => {
                        const hue = HUE[ev.discipline];
                        return (
                          <button
                            key={ev.id}
                            onClick={() => setOpenEvent(ev)}
                            className="flex items-center gap-3 rounded-xl p-3 text-left"
                            style={{
                              background: "var(--surface)",
                              borderLeft: `4px solid ${hue.dot}`,
                            }}
                          >
                            <span
                              className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                              style={{ background: hue.bg, color: hue.fg }}
                            >
                              <StateGlyph d={ev.discipline} state={ev.state} s={17} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-extrabold">
                                  {ev.title}
                                </span>
                                {ev.state === "planned" && (
                                  <span
                                    className="rounded-full px-2 py-px text-[9px] font-bold uppercase tracking-wide"
                                    style={{
                                      color: "var(--accent)",
                                      border: "1px solid var(--accent-line)",
                                    }}
                                  >
                                    Planned
                                  </span>
                                )}
                                {ev.state === "completed-planned" && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] font-bold uppercase"
                                    style={{ color: HUE.lift.fg }}
                                  >
                                    <CheckGlyph s={11} /> done from plan
                                  </span>
                                )}
                              </div>
                              <div
                                className="truncate text-[11.5px] font-semibold"
                                style={{ color: "var(--muted)" }}
                              >
                                {ev.time} · {ev.summary}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* roomy, coaching-toned modals */}
      {openEvent && (
        <div
          className="absolute inset-0 z-20 grid place-items-center p-5"
          style={{ background: "rgba(8,9,12,0.7)" }}
        >
          {!editing ? (
            <RoomyViewModal
              ev={openEvent}
              onClose={() => setOpenEvent(null)}
              onEdit={() => setEditing(true)}
            />
          ) : (
            <RoomyEditModal
              ev={openEvent}
              onClose={() => {
                setEditing(false);
                setOpenEvent(null);
              }}
              onBack={() => setEditing(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Roomy, coaching-toned modals ──────────────────────────────────────────

function MuscleChip({ m }: { m: string }) {
  const hue = HUE.lift;
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
      style={{ background: hue.bg, color: hue.fg }}
    >
      {m}
    </span>
  );
}

function RoomyViewModal({
  ev,
  onClose,
  onEdit,
}: {
  ev: CalEvent;
  onClose: () => void;
  onEdit: () => void;
}) {
  const hue = HUE[ev.discipline];
  const isWorked = ev.id === WORKED_EVENT_ID;
  const rows = isWorked ? WORKED_AGENDA : WORKED_AGENDA.slice(0, 3);
  return (
    <div
      className="flex max-h-full w-[400px] flex-col overflow-hidden rounded-3xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        className="relative p-5"
        style={{ background: "linear-gradient(180deg, var(--accent-soft), transparent)" }}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          style={{ color: "var(--muted)" }}
          aria-label="Close"
        >
          <CloseGlyph s={16} />
        </button>
        <div className="flex items-center gap-2">
          <span
            className="grid h-9 w-9 place-items-center rounded-full"
            style={{ background: hue.bg, color: hue.fg }}
          >
            <DisciplineGlyph d={ev.discipline} s={19} />
          </span>
          <span
            className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: hue.bg, color: hue.fg }}
          >
            {disciplineLabel(ev.discipline)}
          </span>
          {ev.state === "planned" && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
            >
              Planned
            </span>
          )}
        </div>
        <h3 className="mt-3 text-[19px] font-extrabold leading-tight">{ev.title}</h3>
        <div
          className="mt-2 flex flex-wrap items-center gap-3 text-[12px] font-bold"
          style={{ color: "var(--muted)" }}
        >
          <span className="inline-flex items-center gap-1.5">
            <ClockGlyph s={14} /> Tue Jun 16 · 5:00 – 6:30 PM
          </span>
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--faint)" }}>
            <GoogleGlyph s={13} /> Synced
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 overflow-auto px-5 pb-2">
        <div
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "var(--faint)" }}
        >
          Agenda · {WORKED_AGENDA.length} exercises
        </div>
        {rows.map((x, i) => (
          <div
            key={i}
            className="rounded-2xl p-3"
            style={{
              background: "var(--surface-2)",
              borderLeft: x.supersetGroup ? "4px solid var(--accent)" : "4px solid transparent",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-extrabold">
                {i + 1}. {x.name}
              </span>
              <span
                className="shrink-0 text-[12px] font-extrabold tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {x.sets}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {x.muscles.map((m) => (
                <MuscleChip key={m} m={m} />
              ))}
              {x.supersetGroup && (
                <span
                  className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  superset
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div
        className="flex items-center justify-between gap-2 p-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          <PencilGlyph s={13} /> Edit plan
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <PlayGlyph s={12} /> Start workout
        </button>
      </div>
    </div>
  );
}

function RoomyField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "col-span-2" : ""}`}>
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        {label}
      </span>
      <span
        className="rounded-xl px-3 py-2.5 text-[12.5px] font-bold"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {value}
      </span>
    </label>
  );
}

function RoomyEditModal({
  ev,
  onClose,
  onBack,
}: {
  ev: CalEvent;
  onClose: () => void;
  onBack: () => void;
}) {
  return (
    <div
      className="flex max-h-full w-[400px] flex-col overflow-hidden rounded-3xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        className="flex items-center justify-between p-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <h3 className="text-[16px] font-extrabold">Edit planned workout</h3>
        <button
          onClick={onClose}
          className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          style={{ color: "var(--muted)" }}
          aria-label="Close"
        >
          <CloseGlyph s={16} />
        </button>
      </div>
      <div className="flex flex-col gap-3.5 overflow-auto p-5">
        <div
          className="inline-flex self-start rounded-full p-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {(["Lift", "Run"] as const).map((t) => {
            const active = (t === "Lift") === (ev.discipline === "lift");
            return (
              <span
                key={t}
                className="rounded-full px-4 py-1.5 text-[12px] font-bold"
                style={
                  active
                    ? { background: "var(--accent)", color: "var(--accent-fg)" }
                    : { color: "var(--muted)" }
                }
              >
                {t}
              </span>
            );
          })}
        </div>
        <RoomyField label="Name" value={ev.title} full />
        <div className="grid grid-cols-2 gap-3">
          <RoomyField label="Date" value="Jun 16, 2026" />
          <RoomyField label="Start" value="5:00 PM" />
          <RoomyField label="Duration" value="90 min" />
          <RoomyField label="Ends at" value="6:30 PM" />
        </div>
        <RoomyField label="Notes" value="Push/pull · superset finisher" full />
      </div>
      <div
        className="flex items-center justify-between gap-2 p-4"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onBack}
          className="rounded-full px-4 py-2.5 text-[12px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          Cancel
        </button>
        <button
          className="rounded-full px-5 py-2.5 text-[12px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
