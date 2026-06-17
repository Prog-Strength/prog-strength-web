"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Schedule picker for the planned-workout form: a date (calendar popover) +
 * start time + duration, replacing the awkward paired datetime-local inputs.
 * The parent keeps the canonical `date`/`time`/`durationMin` and derives the
 * RFC3339 window at save (see scheduleToRFC3339). End time is shown as a
 * derived hint so the user always sees when the session lands.
 */
export function PlanScheduleField({
  date,
  time,
  durationMin,
  onChange,
}: {
  date: string; // YYYY-MM-DD (local)
  time: string; // HH:MM (24h, local)
  durationMin: number;
  onChange: (next: { date?: string; time?: string; durationMin?: number }) => void;
}) {
  const endLabel = useMemo(() => deriveEndLabel(time, durationMin), [time, durationMin]);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
        <FieldLabel label="Date">
          <DatePopover value={date} onSelect={(d) => onChange({ date: d })} />
        </FieldLabel>
        <FieldLabel label="Start">
          <select
            aria-label="Start time"
            value={time}
            onChange={(e) => onChange({ time: e.target.value })}
            className={selectClasses}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot} value={slot}>
                {formatTime(slot)}
              </option>
            ))}
          </select>
        </FieldLabel>
        <FieldLabel label="Duration">
          <select
            aria-label="Duration"
            value={String(durationMin)}
            onChange={(e) => onChange({ durationMin: Number(e.target.value) })}
            className={selectClasses}
          >
            {DURATIONS.map((m) => (
              <option key={m} value={m}>
                {durationLabel(m)}
              </option>
            ))}
          </select>
        </FieldLabel>
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        Ends at <span className="font-medium text-[var(--foreground)]">{endLabel}</span>
      </p>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

/** A date button that opens a compact calendar popover. */
function DatePopover({ value, onSelect }: { value: string; onSelect: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = parseDateValue(value);
  const [cursor, setCursor] = useState(() => ({
    year: selected.getFullYear(),
    month: selected.getMonth(),
  }));

  // Re-anchor the visible month to the selected date whenever the popover
  // opens, so it never strands the user on a far-away month.
  useEffect(() => {
    if (open) setCursor({ year: selected.getFullYear(), month: selected.getMonth() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const days = useMemo(() => monthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
  const todayValue = dateValue(new Date());

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-left text-sm text-[var(--foreground)] transition outline-none hover:bg-[var(--surface-3)] focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent-line)]"
      >
        <span>{formatDateLabel(value)}</span>
        <CalendarIcon />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          className="absolute left-0 top-full z-10 mt-2 w-[18rem] rounded-xl border border-[var(--border)] bg-[var(--background)] p-3 shadow-2xl"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setCursor(shiftMonth(cursor, -1))}
              className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <Chevron dir="left" />
            </button>
            <span className="text-sm font-medium">{monthLabel}</span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setCursor(shiftMonth(cursor, 1))}
              className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <Chevron dir="right" />
            </button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
              <span
                key={i}
                className="py-1 text-center text-[10px] font-semibold uppercase text-[var(--muted)]"
              >
                {d}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {days.map((day) => {
              const v = dateValue(day);
              const inMonth = day.getMonth() === cursor.month;
              const isSelected = v === value;
              const isToday = v === todayValue;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    onSelect(v);
                    setOpen(false);
                  }}
                  className={[
                    "flex h-8 items-center justify-center rounded-md text-xs transition",
                    isSelected
                      ? "bg-[var(--accent)] font-semibold text-[var(--accent-fg)]"
                      : isToday
                        ? "text-[var(--accent)] hover:bg-[var(--surface-2)]"
                        : inMonth
                          ? "text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                          : "text-[var(--muted)] opacity-50 hover:bg-[var(--surface-2)]",
                  ].join(" ")}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Selects share the modal's field-surface convention: slate on --surface-2, a
// real hairline border, and an accent focus ring (border + 1px ring).
const selectClasses =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] transition outline-none focus-visible:border-[var(--accent)] focus-visible:ring-1 focus-visible:ring-[var(--accent-line)]";

// --- time / duration data --------------------------------------------------

// 15-minute slots across the day, "HH:MM" 24h.
const TIME_SLOTS: string[] = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = (i % 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180];

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function durationLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function deriveEndLabel(time: string, durationMin: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + durationMin) % (24 * 60);
  const eh = Math.floor(total / 60);
  const em = total % 60;
  return formatTime(`${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`);
}

// --- date helpers ----------------------------------------------------------

function dateValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

function parseDateValue(v: string): Date {
  const [y, m, d] = v.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDateLabel(v: string): string {
  return parseDateValue(v).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function shiftMonth(c: { year: number; month: number }, delta: number) {
  const d = new Date(c.year, c.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** A 6-week (42-day) Monday-first grid for the given month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);
  return Array.from(
    { length: 42 },
    (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
  );
}

// --- icons -----------------------------------------------------------------

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={15}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 text-[var(--muted)]"
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={dir === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
  );
}
