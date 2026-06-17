/**
 * VARIANT 4 / 4 — idiom: panel-driven
 * ------------------------------------------------------------------
 * "No modals — a workspace." The month grid stays primary (true-grid
 * discipline, month-bounded), but everything that is a modal today becomes a
 * docked right-hand side panel — in Linear's issue-panel vocabulary. Selecting
 * a day slides that day's sessions into the panel; selecting an event shows its
 * detail in the same panel; the edit form opens in the panel too, not as a
 * centered overlay. The grid never gets covered, so the month stays in view.
 *
 *   • Type scale   — even grid; structured panel with clear section headers
 *                    (WHEN / AGENDA / form fields).
 *   • Color logic  — violet anchors the panel header and primary action; the
 *                    grid is restrained, tonal dots/bars for run vs lift.
 *   • Spacing      — grid + a persistent right column; the panel has its own
 *                    internal rhythm.
 *   • Navigation   — a slim segmented/stepper control above the grid.
 *   • Day detail & modals — unified into the docked panel; the edit form gets a
 *     calm, full-height home with proper form controls.
 *
 * In-system: slate ramp + violet accent + Nunito only. Diverges on composition.
 * THROWAWAY DX mockup — static fixtures, no data services.
 */
"use client";

import { useState } from "react";
import {
  MONTH_WEEKS,
  WEEKDAY_LABELS,
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
  ClockGlyph,
  DisciplineGlyph,
  StateGlyph,
  PlusGlyph,
  PlayGlyph,
  PencilGlyph,
  GoogleGlyph,
} from "./icons";

type PanelMode = "day" | "event" | "edit";

const fmtLong = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

function CellPill({ ev, active, onClick }: { ev: CalEvent; active: boolean; onClick: () => void }) {
  const hue = HUE[ev.discipline];
  const planned = ev.state === "planned";
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${ev.time} · ${ev.title}`}
      className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-[3px] text-left leading-none"
      style={{
        background: planned ? "transparent" : hue.bg,
        border: `1px ${planned ? "dashed" : "solid"} ${hue.line}`,
        boxShadow: active ? "0 0 0 1.5px var(--accent)" : undefined,
      }}
    >
      <span style={{ color: hue.fg }}>
        <StateGlyph d={ev.discipline} state={ev.state} s={10} />
      </span>
      <span className="truncate text-[10px] font-bold">
        {ev.title.replace(/^Recovery Week — /, "")}
      </span>
    </button>
  );
}

export function VariantPanelDriven() {
  const [selectedDay, setSelectedDay] = useState("2026-06-16");
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(
    eventsByDate("2026-06-16").find((e) => e.id === WORKED_EVENT_ID) ?? null,
  );
  const [mode, setMode] = useState<PanelMode>("event");

  const openDay = (iso: string) => {
    setSelectedDay(iso);
    setSelectedEvent(null);
    setMode("day");
  };
  const openEvent = (ev: CalEvent) => {
    setSelectedDay(ev.date);
    setSelectedEvent(ev);
    setMode("event");
  };

  return (
    <div className="flex gap-4" style={{ color: "var(--foreground)" }}>
      {/* LEFT — primary grid + slim segmented stepper */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex items-center justify-between">
          {/* slim segmented stepper */}
          <div
            className="inline-flex items-center overflow-hidden rounded-lg"
            style={{ border: "1px solid var(--border)" }}
          >
            <button
              className="grid h-8 w-8 place-items-center hover:bg-[var(--surface-2)]"
              style={{ color: "var(--muted)", borderRight: "1px solid var(--border)" }}
              aria-label="Previous month"
            >
              <ChevronLeft s={15} />
            </button>
            <span className="px-3 text-[12.5px] font-extrabold">June 2026</span>
            <button
              className="grid h-8 w-8 place-items-center hover:bg-[var(--surface-2)]"
              style={{ color: "var(--muted)", borderLeft: "1px solid var(--border)" }}
              aria-label="Next month"
            >
              <ChevronRight s={15} />
            </button>
            <button
              className="px-3 py-1.5 text-[11.5px] font-bold hover:bg-[var(--surface-2)]"
              style={{ color: "var(--muted)", borderLeft: "1px solid var(--border)" }}
            >
              Today
            </button>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-bold"
            style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
          >
            <PlusGlyph s={13} /> Plan a workout
          </button>
        </div>

        <div className="overflow-hidden rounded-xl" style={{ border: "1px solid var(--border)" }}>
          <div className="grid grid-cols-7">
            {WEEKDAY_LABELS.map((w) => (
              <div
                key={w}
                className="px-2 py-1.5 text-[9.5px] font-bold uppercase tracking-wider"
                style={{ color: "var(--faint)", borderBottom: "1px solid var(--border)" }}
              >
                {w}
              </div>
            ))}
          </div>
          {MONTH_WEEKS.map((week, wi) => (
            <div
              key={wi}
              className="grid grid-cols-7"
              style={{ borderTop: wi === 0 ? "none" : "1px solid var(--border)" }}
            >
              {week.map((cell) => {
                const evs = eventsByDate(cell.iso);
                const isSel = cell.iso === selectedDay;
                return (
                  <div
                    key={cell.iso}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDay(cell.iso)}
                    className="flex min-h-[84px] cursor-pointer flex-col gap-1 p-1.5 text-left"
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
                        isSel && !cell.isToday ? "inset 0 0 0 1px var(--accent-line)" : undefined,
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
                        <CellPill
                          key={ev.id}
                          ev={ev}
                          active={selectedEvent?.id === ev.id}
                          onClick={() => openEvent(ev)}
                        />
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
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — persistent docked panel (no overlays, ever) */}
      <aside
        className="flex w-[320px] shrink-0 flex-col self-start overflow-hidden rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {mode === "day" && <DayPanel iso={selectedDay} onPick={openEvent} />}
        {mode === "event" && selectedEvent && (
          <EventPanel
            ev={selectedEvent}
            onBack={() => openDay(selectedEvent.date)}
            onEdit={() => setMode("edit")}
          />
        )}
        {mode === "edit" && selectedEvent && (
          <EditPanel ev={selectedEvent} onCancel={() => setMode("event")} />
        )}
      </aside>
    </div>
  );
}

function PanelHeader({
  kicker,
  title,
  accent,
}: {
  kicker: string;
  title: string;
  accent?: boolean;
}) {
  return (
    <div
      className="p-4"
      style={{
        background: accent
          ? "linear-gradient(180deg, var(--accent-soft), transparent)"
          : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div
        className="text-[9.5px] font-bold uppercase tracking-wider"
        style={{ color: accent ? "var(--accent)" : "var(--faint)" }}
      >
        {kicker}
      </div>
      <div className="mt-1 text-[15px] font-extrabold leading-tight">{title}</div>
    </div>
  );
}

function DayPanel({ iso, onPick }: { iso: string; onPick: (ev: CalEvent) => void }) {
  const evs = eventsByDate(iso);
  return (
    <>
      <PanelHeader kicker="Selected day" title={fmtLong(iso)} />
      <div className="flex flex-col gap-2 p-4">
        {evs.length === 0 ? (
          <div
            className="rounded-xl px-3 py-8 text-center text-[12px] font-semibold"
            style={{ color: "var(--faint)", border: "1px dashed var(--border-strong)" }}
          >
            Rest day — nothing logged or planned.
          </div>
        ) : (
          evs.map((ev) => {
            const hue = HUE[ev.discipline];
            return (
              <button
                key={ev.id}
                onClick={() => onPick(ev)}
                className="flex items-center gap-2.5 rounded-xl p-2.5 text-left"
                style={{ background: "var(--surface-2)", borderLeft: `3px solid ${hue.dot}` }}
              >
                <span style={{ color: hue.fg }}>
                  <StateGlyph d={ev.discipline} state={ev.state} s={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] font-extrabold">{ev.title}</span>
                    {ev.state === "planned" && (
                      <span
                        className="rounded-full px-1.5 py-px text-[8px] font-bold uppercase"
                        style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
                      >
                        Plan
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
          })
        )}
      </div>
    </>
  );
}

function MuscleChip({ m }: { m: string }) {
  return (
    <span
      className="rounded-full px-1.5 py-px text-[8.5px] font-bold uppercase tracking-wide"
      style={{ background: "var(--surface-3)", color: "var(--muted)" }}
    >
      {m}
    </span>
  );
}

function EventPanel({
  ev,
  onBack,
  onEdit,
}: {
  ev: CalEvent;
  onBack: () => void;
  onEdit: () => void;
}) {
  const hue = HUE[ev.discipline];
  const isWorked = ev.id === WORKED_EVENT_ID;
  return (
    <>
      <div
        className="p-4"
        style={{
          background: "linear-gradient(180deg, var(--accent-soft), transparent)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          onClick={onBack}
          className="mb-2 inline-flex items-center gap-1 text-[10.5px] font-bold"
          style={{ color: "var(--muted)" }}
        >
          <ChevronLeft s={12} /> {fmtLong(ev.date)}
        </button>
        <div className="flex items-center gap-2">
          <span
            className="grid h-7 w-7 place-items-center rounded-full"
            style={{ background: hue.bg, color: hue.fg }}
          >
            <DisciplineGlyph d={ev.discipline} s={15} />
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
            style={{ background: hue.bg, color: hue.fg }}
          >
            {disciplineLabel(ev.discipline)}
          </span>
          {ev.state === "planned" && (
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide"
              style={{ color: "var(--accent)", border: "1px solid var(--accent-line)" }}
            >
              Planned
            </span>
          )}
        </div>
        <h3 className="mt-2 text-[15px] font-extrabold leading-tight">{ev.title}</h3>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: "var(--faint)" }}
        >
          When
        </div>
        <div
          className="mt-1.5 flex items-center gap-2 rounded-lg px-2.5 py-2"
          style={{ background: "var(--surface-2)" }}
        >
          <ClockGlyph s={13} style={{ color: "var(--muted)" }} />
          <span className="text-[11px] font-bold">Tue Jun 16 · 5:00 – 6:30 PM</span>
        </div>
        <div
          className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold"
          style={{ color: "var(--faint)" }}
        >
          <GoogleGlyph s={12} /> Synced to Google Calendar
        </div>

        <div
          className="mt-4 text-[9px] font-bold uppercase tracking-wider"
          style={{ color: "var(--faint)" }}
        >
          Agenda · {WORKED_AGENDA.length} exercises
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {(isWorked ? WORKED_AGENDA : WORKED_AGENDA.slice(0, 3)).map((x, i) => (
            <div
              key={i}
              className="rounded-lg px-2.5 py-1.5"
              style={{
                background: "var(--surface-2)",
                borderLeft: x.supersetGroup ? "3px solid var(--accent)" : "3px solid transparent",
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
            </div>
          ))}
        </div>
      </div>

      <div
        className="flex items-center justify-between gap-2 p-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          <PencilGlyph s={12} /> Edit
        </button>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          <PlayGlyph s={11} /> Start workout
        </button>
      </div>
    </>
  );
}

function PanelField({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1 ${full ? "col-span-2" : ""}`}>
      <span
        className="text-[9px] font-bold uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        {label}
      </span>
      <span
        className="rounded-lg px-2.5 py-2 text-[11px] font-bold"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {value}
      </span>
    </label>
  );
}

function EditPanel({ ev, onCancel }: { ev: CalEvent; onCancel: () => void }) {
  return (
    <>
      <PanelHeader kicker="Editing" title="Edit planned workout" accent />
      <div className="flex-1 overflow-auto p-4">
        <div
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{ color: "var(--faint)" }}
        >
          Activity
        </div>
        <div
          className="mt-1.5 inline-flex rounded-lg p-0.5"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
        >
          {(["Lift", "Run"] as const).map((t) => {
            const active = (t === "Lift") === (ev.discipline === "lift");
            return (
              <span
                key={t}
                className="rounded-md px-3.5 py-1.5 text-[11px] font-bold"
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

        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          <PanelField label="Name" value={ev.title} full />
          <PanelField label="Date" value="Jun 16, 2026" />
          <PanelField label="Start" value="5:00 PM" />
          <PanelField label="Duration" value="90 min" />
          <PanelField label="Ends at" value="6:30 PM" />
          <PanelField label="Notes" value="Push/pull · superset finisher" full />
        </div>

        <div
          className="mt-4 text-[9px] font-bold uppercase tracking-wider"
          style={{ color: "var(--faint)" }}
        >
          Agenda
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {WORKED_AGENDA.map((x, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5"
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderLeft: x.supersetGroup ? "3px solid var(--accent)" : "1px solid var(--border)",
              }}
            >
              <span className="truncate text-[11px] font-bold">{x.name}</span>
              <span
                className="shrink-0 text-[10.5px] font-extrabold tabular-nums"
                style={{ color: "var(--muted)" }}
              >
                {x.sets}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div
        className="flex items-center justify-between gap-2 p-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-[11px] font-bold"
          style={{ background: "var(--surface-2)", color: "var(--muted)" }}
        >
          Cancel
        </button>
        <button
          className="rounded-lg px-3.5 py-2 text-[11px] font-bold"
          style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
        >
          Save changes
        </button>
      </div>
    </>
  );
}
