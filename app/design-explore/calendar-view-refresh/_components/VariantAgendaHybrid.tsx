/**
 * VARIANT 3 / 4 — idiom: agenda-hybrid
 * ------------------------------------------------------------------
 * "The calendar as an agenda." Reframes the surface around the list, in the
 * Notion Calendar / Fantastical-sidebar vocabulary. A small, glanceable month
 * mini-grid (date-picker scale) sits beside a prominent agenda column that is
 * the main content: the selected day's sessions as full, readable rows. This
 * directly upgrades the weak day view by making it the hero.
 *
 *   • Type scale   — dramatic: tiny grid numerals against large agenda rows.
 *   • Color logic  — mini-grid near-monochrome (violet on today/selected, tonal
 *                    dots); the agenda rows carry the tonal-hue accents.
 *   • Spacing      — two-column; the grid quiet, the agenda spacious.
 *   • Navigation   — clicking the mini-grid IS navigation; paging the small grid
 *                    changes the month. No header utility bar.
 *   • Day detail   — there is no separate digest: the agenda is the day detail.
 *                    A row expands inline (the lighter "view"); edit opens a
 *                    focused form.
 *
 * In-system: slate ramp + violet accent + Nunito only. Diverges on composition.
 * THROWAWAY DX mockup — static fixtures, no data services.
 */
"use client";

import { useState } from "react";
import {
  MONTH_WEEKS,
  WEEK_STATS,
  eventsByDate,
  HUE,
  WORKED_EVENT_ID,
  WORKED_AGENDA,
  disciplineLabel,
  type CalEvent,
} from "./fixtures";
import {
  ChevronLeft,
  ChevronRight,
  StateGlyph,
  CheckGlyph,
  PlusGlyph,
  CloseGlyph,
  PlayGlyph,
  PencilGlyph,
  GoogleGlyph,
} from "./icons";

const MINI_WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const fmtLong = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function MuscleChip({ m }: { m: string }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wide"
      style={{ background: HUE.lift.bg, color: HUE.lift.fg }}
    >
      {m}
    </span>
  );
}

function AgendaRow({
  ev,
  expanded,
  onToggle,
  onEdit,
}: {
  ev: CalEvent;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const hue = HUE[ev.discipline];
  const isWorked = ev.id === WORKED_EVENT_ID;
  const planned = ev.state === "planned";
  return (
    <div
      className="overflow-hidden rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <button onClick={onToggle} className="flex w-full items-stretch gap-3 p-3.5 text-left">
        {/* time rail */}
        <div className="flex w-14 shrink-0 flex-col items-end pt-0.5">
          <span className="text-[13px] font-extrabold tabular-nums">
            {ev.time.replace(/ ?[AP]M$/, "")}
          </span>
          <span className="text-[9px] font-bold uppercase" style={{ color: "var(--faint)" }}>
            {ev.time.includes("PM") ? "PM" : "AM"}
          </span>
        </div>
        {/* tonal hue bar */}
        <span
          className="w-1 shrink-0 rounded-full"
          style={{
            background: planned ? "transparent" : hue.dot,
            border: planned ? `1.5px dashed ${hue.line}` : "none",
          }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span style={{ color: hue.fg }}>
              <StateGlyph d={ev.discipline} state={ev.state} s={15} />
            </span>
            <span className="truncate text-[15px] font-extrabold">{ev.title}</span>
            {planned && (
              <span
                className="rounded-full px-2 py-px text-[9px] font-bold uppercase tracking-wide"
                style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
              >
                Planned
              </span>
            )}
            {ev.state === "completed-planned" && (
              <span
                className="inline-flex items-center gap-1 text-[9px] font-bold uppercase"
                style={{ color: HUE.lift.fg }}
              >
                <CheckGlyph s={11} /> done
              </span>
            )}
          </div>
          <div
            className="mt-0.5 flex items-center gap-2 text-[12px] font-semibold"
            style={{ color: "var(--muted)" }}
          >
            <span
              className="rounded-full px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide"
              style={{ background: hue.bg, color: hue.fg }}
            >
              {disciplineLabel(ev.discipline)}
            </span>
            <span className="truncate">{ev.summary}</span>
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between py-3">
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold"
              style={{ color: "var(--faint)" }}
            >
              <GoogleGlyph s={12} /> Synced to Google Calendar
            </span>
            <div className="flex gap-2">
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
                <PlayGlyph s={11} /> Start
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            {(isWorked ? WORKED_AGENDA : WORKED_AGENDA.slice(0, 3)).map((x, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-2 rounded-xl px-3 py-2"
                style={{
                  background: "var(--surface-2)",
                  borderLeft: x.supersetGroup ? "3px solid var(--accent)" : "3px solid transparent",
                }}
              >
                <div className="min-w-0">
                  <span className="text-[12px] font-bold">
                    {i + 1}. {x.name}
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {x.muscles.map((m) => (
                      <MuscleChip key={m} m={m} />
                    ))}
                    {x.supersetGroup && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        superset
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className="shrink-0 text-[12px] font-extrabold tabular-nums"
                  style={{ color: "var(--muted)" }}
                >
                  {x.sets}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function VariantAgendaHybrid() {
  const [selected, setSelected] = useState("2026-06-16"); // dense day showcases the agenda hero
  const [expandedId, setExpandedId] = useState<string | null>(WORKED_EVENT_ID);
  const [editEvent, setEditEvent] = useState<CalEvent | null>(null);
  const dayEvents = eventsByDate(selected);

  const selWeekIdx = MONTH_WEEKS.findIndex((w) => w.some((c) => c.iso === selected));
  const weekStat = WEEK_STATS[selWeekIdx] ?? WEEK_STATS[0];

  return (
    <div className="relative flex gap-5" style={{ color: "var(--foreground)" }}>
      {/* LEFT — quiet mini-grid; clicking it is navigation */}
      <div className="w-[236px] shrink-0">
        <div
          className="rounded-2xl p-3.5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-extrabold">June 2026</span>
            <div className="flex gap-1">
              <button
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-2)]"
                style={{ color: "var(--muted)" }}
                aria-label="Previous month"
              >
                <ChevronLeft s={13} />
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--surface-2)]"
                style={{ color: "var(--muted)" }}
                aria-label="Next month"
              >
                <ChevronRight s={13} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-y-1">
            {MINI_WEEKDAYS.map((w, i) => (
              <div
                key={i}
                className="text-center text-[9px] font-bold uppercase"
                style={{ color: "var(--faint)" }}
              >
                {w}
              </div>
            ))}
            {MONTH_WEEKS.flat().map((cell) => {
              const evs = eventsByDate(cell.iso);
              const isSel = cell.iso === selected;
              return (
                <button
                  key={cell.iso}
                  onClick={() => {
                    setSelected(cell.iso);
                    setExpandedId(null);
                  }}
                  className="mx-auto flex h-7 w-7 flex-col items-center justify-center rounded-full"
                  style={{
                    background: cell.isToday
                      ? "var(--accent)"
                      : isSel
                        ? "var(--accent-soft)"
                        : "transparent",
                    boxShadow:
                      isSel && !cell.isToday ? "inset 0 0 0 1px var(--accent-line)" : undefined,
                    opacity: cell.inMonth ? 1 : 0.32,
                  }}
                >
                  <span
                    className="text-[10.5px] font-bold tabular-nums leading-none"
                    style={{
                      color: cell.isToday
                        ? "var(--accent-fg)"
                        : cell.inMonth
                          ? "var(--foreground)"
                          : "var(--faint)",
                    }}
                  >
                    {cell.dayNum}
                  </span>
                  <span className="mt-0.5 flex h-1 items-center gap-[2px]">
                    {evs.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="h-[3px] w-[3px] rounded-full"
                        style={{
                          background: cell.isToday ? "var(--accent-fg)" : HUE[e.discipline].dot,
                        }}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>

          {/* compact week summary under the mini-grid */}
          <div className="mt-3 rounded-xl p-2.5" style={{ background: "var(--surface-2)" }}>
            <div
              className="text-[10px] font-bold uppercase tracking-wide"
              style={{ color: "var(--faint)" }}
            >
              {weekStat.label}
            </div>
            <div className="mt-1 flex items-center gap-1">
              {weekStat.dots.map((on, i) => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={
                    on
                      ? { background: "var(--accent)" }
                      : { border: "1px solid var(--border-strong)" }
                  }
                />
              ))}
            </div>
            <div className="mt-1.5 text-[11px] font-bold">
              {weekStat.trained} of 7 days · lift {weekStat.lift}
            </div>
          </div>

          <button
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-[12px] font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <PlusGlyph s={14} /> Plan a workout
          </button>
        </div>
      </div>

      {/* RIGHT — agenda is the hero (and the day detail) */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[22px] font-extrabold leading-none">{fmtLong(selected)}</h3>
          <span className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>
            {dayEvents.length} {dayEvents.length === 1 ? "session" : "sessions"}
          </span>
        </div>

        {dayEvents.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-12 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-[14px] font-extrabold">Nothing scheduled</div>
            <div className="mt-1 text-[12px] font-semibold" style={{ color: "var(--faint)" }}>
              An open day. Rest is part of the plan — or plan something below.
            </div>
            <button
              className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-bold"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              <PlusGlyph s={13} /> Add a session
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {dayEvents.map((ev) => (
              <AgendaRow
                key={ev.id}
                ev={ev}
                expanded={expandedId === ev.id}
                onToggle={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                onEdit={() => setEditEvent(ev)}
              />
            ))}
          </div>
        )}
      </div>

      {/* focused edit form (scoped to this frame) */}
      {editEvent && <FocusedEditForm ev={editEvent} onClose={() => setEditEvent(null)} />}
    </div>
  );
}

function FocusedField({ label, value, full }: { label: string; value: string; full?: boolean }) {
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

function FocusedEditForm({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center p-5"
      style={{ background: "rgba(8,9,12,0.7)" }}
    >
      <div
        className="w-[380px] overflow-hidden rounded-3xl"
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
          <h3 className="text-[16px] font-extrabold">Edit session</h3>
          <button
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-full hover:bg-[var(--surface-2)]"
            style={{ color: "var(--muted)" }}
            aria-label="Close"
          >
            <CloseGlyph s={16} />
          </button>
        </div>
        <div className="flex flex-col gap-3.5 p-5">
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
          <FocusedField label="Name" value={ev.title} full />
          <div className="grid grid-cols-2 gap-3">
            <FocusedField label="Date" value="Jun 16, 2026" />
            <FocusedField label="Start" value={ev.time} />
          </div>
        </div>
        <div
          className="flex items-center justify-between p-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            onClick={onClose}
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
    </div>
  );
}
