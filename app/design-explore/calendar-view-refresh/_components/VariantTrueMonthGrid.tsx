/**
 * VARIANT 1 / 4 — idiom: true-month-grid
 * ------------------------------------------------------------------
 * "Make it a real calendar, done right." A disciplined, bordered Mon→Sun
 * month grid in the Google Calendar / Fantastical vocabulary, re-toned to
 * slate. Exactly the current month's week rows; adjacent-month days are quiet
 * greyed cells inside the boundary rows (structural, not patched). The per-week
 * rollup collapses into a slim 7th "week" column on the right.
 *
 *   • Type scale   — small and even; hierarchy from weight + day-number.
 *   • Color logic  — frugal/near-monochrome; tonal left-bars + dots mark
 *                    run vs lift; violet spent ONLY on today + the selected cell.
 *   • Spacing      — tight, gridded, calendar-native.
 *   • Navigation   — a quiet inline month stepper pill, demoted from the hero.
 *   • Day detail   — inline panel beneath the grid.
 *   • Modals       — centered slate panels (scoped to this frame in the mockup).
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
  MONTH_STATS,
  TODAY_ISO,
  WORKED_EVENT_ID,
  WORKED_AGENDA,
  disciplineLabel,
  type CalEvent,
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
    year: "numeric",
  });
};

function GridPill({ ev, onClick }: { ev: CalEvent; onClick: () => void }) {
  const hue = HUE[ev.discipline];
  const planned = ev.state === "planned";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${ev.time} · ${ev.title}`}
      className="group flex w-full items-center gap-1.5 rounded-[6px] px-1.5 py-[3px] text-left leading-none transition-colors"
      style={{
        background: planned ? "transparent" : hue.bg,
        border: `1px ${planned ? "dashed" : "solid"} ${hue.line}`,
      }}
    >
      <span className="grid h-3 w-3 place-items-center rounded-[3px]" style={{ color: hue.fg }}>
        <StateGlyph d={ev.discipline} state={ev.state} s={11} />
      </span>
      <span className="truncate text-[10.5px] font-bold" style={{ color: "var(--foreground)" }}>
        {ev.title.replace(/^Recovery Week — /, "")}
      </span>
    </button>
  );
}

export function VariantTrueMonthGrid() {
  const [selected, setSelected] = useState(TODAY_ISO);
  const [openEvent, setOpenEvent] = useState<CalEvent | null>(null);
  const [editing, setEditing] = useState(false);

  const dayEvents = eventsByDate(selected);

  return (
    <div className="relative flex flex-col gap-3" style={{ color: "var(--foreground)" }}>
      {/* Hero stat row — frugal, monochrome */}
      <div
        className="grid grid-cols-6 gap-px overflow-hidden rounded-xl"
        style={{ background: "var(--border)" }}
      >
        {MONTH_STATS.map((s) => (
          <div key={s.label} className="px-2.5 py-2" style={{ background: "var(--surface)" }}>
            <div className="text-[15px] font-extrabold tabular-nums">{s.value}</div>
            <div
              className="text-[9.5px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--faint)" }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {/* Demoted inline month stepper + actions */}
      <div className="flex items-center justify-between">
        <div
          className="inline-flex items-center gap-1 rounded-full px-1 py-1"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          <button
            className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-3)]"
            style={{ color: "var(--muted)" }}
            aria-label="Previous month"
          >
            <ChevronLeft s={14} />
          </button>
          <span className="px-1.5 text-[12.5px] font-extrabold">June 2026</span>
          <button
            className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-3)]"
            style={{ color: "var(--muted)" }}
            aria-label="Next month"
          >
            <ChevronRight s={14} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-full px-3 py-1.5 text-[11.5px] font-bold"
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--muted)",
            }}
          >
            Today
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <PlusGlyph s={13} /> Plan a workout
          </button>
        </div>
      </div>

      {/* The grid: 7 day columns + slim 7th "week" rollup column */}
      <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
        {/* weekday header */}
        <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr) 84px" }}>
          {WEEKDAY_LABELS.map((w) => (
            <div
              key={w}
              className="px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
              style={{ color: "var(--faint)", borderBottom: "1px solid var(--border)" }}
            >
              {w}
            </div>
          ))}
          <div
            className="px-2 py-1.5 text-right text-[9.5px] font-bold uppercase tracking-wider"
            style={{
              color: "var(--faint)",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            Week
          </div>
        </div>

        {MONTH_WEEKS.map((week, wi) => {
          const stat = WEEK_STATS[wi];
          return (
            <div
              key={wi}
              className="grid"
              style={{
                gridTemplateColumns: "repeat(7, 1fr) 84px",
                borderTop: wi === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              {week.map((cell) => {
                const evs = eventsByDate(cell.iso);
                const isSel = cell.iso === selected;
                return (
                  <div
                    key={cell.iso}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(cell.iso)}
                    className="flex min-h-[78px] cursor-pointer flex-col gap-1 p-1.5 text-left align-top transition-colors"
                    style={{
                      borderLeft: "1px solid var(--border)",
                      background: cell.isToday
                        ? "var(--accent-soft)"
                        : isSel
                          ? "var(--surface-2)"
                          : cell.inMonth
                            ? "transparent"
                            : "rgba(0,0,0,0.18)",
                      boxShadow:
                        isSel && !cell.isToday ? "inset 0 0 0 1px var(--border-strong)" : undefined,
                      opacity: cell.inMonth ? 1 : 0.45,
                    }}
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold tabular-nums"
                      style={
                        cell.isToday
                          ? { background: "var(--accent)", color: "var(--accent-fg)" }
                          : { color: cell.inMonth ? "var(--foreground)" : "var(--faint)" }
                      }
                    >
                      {cell.dayNum}
                    </span>
                    <div className="flex flex-col gap-[3px]">
                      {evs.slice(0, 3).map((ev) => (
                        <GridPill key={ev.id} ev={ev} onClick={() => setOpenEvent(ev)} />
                      ))}
                      {evs.length > 3 && (
                        <span
                          className="px-1 text-[9.5px] font-bold"
                          style={{ color: "var(--muted)" }}
                        >
                          +{evs.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* slim week-rollup column */}
              <div
                className="flex flex-col justify-center gap-1 px-2 py-1.5"
                style={{
                  borderLeft: "1px solid var(--border-strong)",
                  background: "var(--surface)",
                }}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[13px] font-extrabold tabular-nums">{stat.trained}</span>
                  <span className="text-[9.5px] font-semibold" style={{ color: "var(--faint)" }}>
                    / 7 days
                  </span>
                </div>
                <div
                  className="text-[9.5px] font-semibold leading-tight"
                  style={{ color: "var(--muted)" }}
                >
                  {stat.lift}
                </div>
                <div
                  className="text-[9.5px] font-semibold leading-tight"
                  style={{ color: HUE.run.fg }}
                >
                  {stat.run}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Day detail — inline panel beneath the grid */}
      <div
        className="rounded-xl p-3"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="mb-2 flex items-baseline justify-between">
          <div className="text-[12.5px] font-extrabold">{fmtDate(selected)}</div>
          <div className="text-[10.5px] font-semibold" style={{ color: "var(--faint)" }}>
            {dayEvents.length} {dayEvents.length === 1 ? "activity" : "activities"}
          </div>
        </div>
        {dayEvents.length === 0 ? (
          <div
            className="rounded-lg px-3 py-4 text-center text-[11px] font-semibold"
            style={{ color: "var(--faint)", border: "1px dashed var(--border-strong)" }}
          >
            Rest day — nothing logged or planned.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {dayEvents.map((ev) => {
              const hue = HUE[ev.discipline];
              const planned = ev.state === "planned";
              return (
                <button
                  key={ev.id}
                  onClick={() => setOpenEvent(ev)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left"
                  style={{ background: "var(--surface-2)", borderLeft: `3px solid ${hue.dot}` }}
                >
                  <span style={{ color: hue.fg }}>
                    <StateGlyph d={ev.discipline} state={ev.state} s={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[12px] font-extrabold">{ev.title}</span>
                      {planned && (
                        <span
                          className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide"
                          style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
                        >
                          Planned
                        </span>
                      )}
                      {ev.state === "completed-planned" && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[8.5px] font-bold uppercase"
                          style={{ color: HUE.lift.fg }}
                        >
                          <CheckGlyph s={10} /> done
                        </span>
                      )}
                    </div>
                    <div
                      className="truncate text-[10.5px] font-semibold"
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

      {/* Centered, re-toned slate modals (scoped to this frame) */}
      {openEvent && (
        <div
          className="absolute inset-0 z-20 grid place-items-center p-4"
          style={{ background: "rgba(8,9,12,0.66)" }}
        >
          {!editing ? (
            <CompactViewModal
              ev={openEvent}
              onClose={() => setOpenEvent(null)}
              onEdit={() => setEditing(true)}
            />
          ) : (
            <CompactEditModal
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

// ── Centered slate modals — compact, calendar-native re-tone ──────────────

function MuscleChip({ m }: { m: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide"
      style={{
        background: "var(--surface-3)",
        color: "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      {m}
    </span>
  );
}

function CompactViewModal({
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
  return (
    <div
      className="flex max-h-full w-[340px] flex-col overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        className="flex items-start gap-2 p-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="mt-0.5" style={{ color: hue.fg }}>
          <DisciplineGlyph d={ev.discipline} s={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-extrabold leading-tight">{ev.title}</div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide"
              style={{ background: hue.bg, color: hue.fg }}
            >
              {disciplineLabel(ev.discipline)}
            </span>
            {ev.state === "planned" && (
              <span
                className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide"
                style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
              >
                Planned
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          style={{ color: "var(--muted)" }}
          aria-label="Close"
        >
          <CloseGlyph s={15} />
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-auto p-3.5">
        <div
          className="flex items-center gap-2 rounded-lg px-2.5 py-2"
          style={{ background: "var(--surface-2)" }}
        >
          <ClockGlyph s={14} style={{ color: "var(--muted)" }} />
          <span className="text-[11px] font-bold">Tue Jun 16 · 5:00 – 6:30 PM</span>
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] font-semibold"
          style={{ color: "var(--faint)" }}
        >
          <GoogleGlyph s={12} /> Synced to Google Calendar
        </div>

        <div>
          <div
            className="mb-1.5 text-[9.5px] font-bold uppercase tracking-wider"
            style={{ color: "var(--faint)" }}
          >
            Agenda
          </div>
          <ol className="flex flex-col gap-1">
            {(isWorked ? WORKED_AGENDA : WORKED_AGENDA.slice(0, 3)).map((x, i) => (
              <li
                key={i}
                className="rounded-lg px-2.5 py-1.5"
                style={{
                  background: "var(--surface-2)",
                  borderLeft: x.supersetGroup
                    ? `3px solid var(--accent-line)`
                    : "3px solid transparent",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[11px] font-bold">
                    {i + 1}. {x.name}
                  </span>
                  <span
                    className="shrink-0 text-[10.5px] font-extrabold tabular-nums"
                    style={{ color: "var(--muted)" }}
                  >
                    {x.sets}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {x.muscles.map((m) => (
                    <MuscleChip key={m} m={m} />
                  ))}
                  {x.supersetGroup && (
                    <span
                      className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase"
                      style={{ color: "var(--accent)" }}
                    >
                      superset
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 p-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          <PencilGlyph s={12} /> Edit
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <PlayGlyph s={11} /> Start workout
        </button>
      </div>
    </div>
  );
}

function Field({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        {label}
      </span>
      <span
        className="rounded-lg px-2.5 py-1.5 text-[11px] font-bold"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {value}
      </span>
    </label>
  );
}

function CompactEditModal({
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
      className="flex max-h-full w-[340px] flex-col overflow-hidden rounded-2xl"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-strong)",
        boxShadow: "var(--shadow-soft)",
      }}
    >
      <div
        className="flex items-center justify-between p-3.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[13px] font-extrabold">Edit planned workout</span>
        <button
          onClick={onClose}
          className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-2)]"
          style={{ color: "var(--muted)" }}
          aria-label="Close"
        >
          <CloseGlyph s={15} />
        </button>
      </div>
      <div className="flex flex-col gap-3 overflow-auto p-3.5">
        {/* Lift / Run toggle — pill segmented */}
        <div
          className="inline-flex self-start rounded-full p-0.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {(["Lift", "Run"] as const).map((t) => {
            const active = (t === "Lift") === (ev.discipline === "lift");
            return (
              <span
                key={t}
                className="rounded-full px-3 py-1 text-[10.5px] font-bold"
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
        <Field label="Name" value={ev.title} full />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Date" value="Jun 16, 2026" />
          <Field label="Start" value="5:00 PM" />
          <Field label="Duration" value="90 min" />
          <Field label="Ends at" value="6:30 PM" />
        </div>
        <Field label="Notes" value="Push/pull · superset finisher" full />
      </div>
      <div
        className="flex items-center justify-between gap-2 p-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onBack}
          className="rounded-full px-3 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          Cancel
        </button>
        <button
          className="rounded-full px-3.5 py-1.5 text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          Save changes
        </button>
      </div>
    </div>
  );
}
