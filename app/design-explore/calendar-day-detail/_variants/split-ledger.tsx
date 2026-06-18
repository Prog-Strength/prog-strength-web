"use client";

/**
 * IDIOM: split-ledger — draws on Linear (minimal).
 *
 * Composition: the most restrained, chrome-light layout. The left list is a
 * quiet LEDGER of rows separated only by hairlines — no card backgrounds —
 * and the right pane is a wide reading column where hierarchy comes almost
 * entirely from TYPOGRAPHY AND WHITESPACE rather than borders or fills. The
 * largest negative space of the five; the test of whether the day detail
 * can feel finished with the least visual weight.
 *
 * Divergence axes (within the design system's palette/accent/type):
 *  - type scale: type-led hierarchy — weight + size carry structure
 *  - spacing rhythm: the most generous; wide reading measure, airy rows
 *  - layout: borderless ledger left, single wide prose-like column right
 */

import { useMemo, useState } from "react";
import { activityColors } from "@/lib/activity-colors";
import { disciplineOf } from "@/components/calendar/derivations";
import type { CalendarEvent } from "@/components/calendar/types";
import {
  eventId,
  eventTitle,
  exerciseMap,
  fmtTime,
  fmtWindow,
  fmtSpan,
  lifecycleOf,
  windowOf,
  type Lifecycle,
  type Scenario,
} from "../_fixtures";
import {
  plannedAgenda,
  runMetrics,
  runTypeLabel,
  workoutMetrics,
  type MetricTile,
} from "../_agenda";

const STATUS: Record<Lifecycle, string> = {
  planned: "Planned",
  completed: "Completed",
  skipped: "Skipped",
  logged: "Logged",
};

export default function SplitLedger({ scenario }: { scenario: Scenario }) {
  const events = useMemo(
    () => [...scenario.events].sort((a, b) => a.startMs - b.startMs),
    [scenario.events],
  );
  const [selId, setSelId] = useState<string | null>(events[0] ? eventId(events[0]) : null);
  const selected = events.find((e) => eventId(e) === selId) ?? events[0] ?? null;

  if (events.length === 0) return <RestDay />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* LEDGER */}
      <div className="py-2 lg:border-r lg:border-[var(--border)]">
        {events.map((e) => {
          const c = activityColors(disciplineOf(e));
          const life = lifecycleOf(e);
          const active = eventId(e) === selId;
          const { startIso } = windowOf(e);
          return (
            <button
              key={eventId(e)}
              type="button"
              onClick={() => setSelId(eventId(e))}
              className="flex w-full items-center gap-3 border-b border-[var(--border)] px-5 py-3.5 text-left transition hover:bg-[var(--surface)]/50"
            >
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: c.dot, opacity: life === "skipped" ? 0.4 : 1 }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[14px] ${
                    active ? "font-semibold text-[var(--foreground)]" : "font-medium"
                  } ${life === "skipped" ? "text-[var(--muted)] line-through" : active ? "" : "text-[var(--foreground)]/90"}`}
                >
                  {eventTitle(e)}
                </span>
                <span className="mt-0.5 block text-[12px] tabular-nums text-[var(--faint)]">
                  {fmtTime(startIso)} · {STATUS[life]}
                </span>
              </span>
              {active && (
                <span className="text-[var(--muted)]" aria-hidden>
                  ›
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* READING COLUMN */}
      <div className="hidden lg:block">{selected && <Reading event={selected} />}</div>
    </div>
  );
}

function Reading({ event }: { event: CalendarEvent }) {
  const c = activityColors(disciplineOf(event));
  const life = lifecycleOf(event);
  const { startIso, endIso } = windowOf(event);

  return (
    <div className="px-10 py-9">
      <div className="mx-auto max-w-xl">
        {/* eyebrow */}
        <p className="flex items-center gap-2 text-[12px] tabular-nums text-[var(--muted)]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: c.dot }}
            aria-hidden
          />
          {fmtWindow(startIso, endIso)}
          <span className="text-[var(--faint)]">·</span>
          <span>{STATUS[life]}</span>
        </p>
        {/* title carries the weight */}
        <h2 className="mt-3 text-[28px] font-semibold leading-tight tracking-tight text-[var(--foreground)]">
          {eventTitle(event)}
        </h2>
        <p className="mt-1.5 text-[14px] text-[var(--muted)]">{fmtSpan(startIso, endIso)}</p>

        <div className="mt-9">
          <Body event={event} fg={c.fg} />
        </div>

        {/* quiet inline actions — text, not buttons */}
        <div className="mt-10 flex items-center gap-6 text-[13px]">
          {life === "planned" ? (
            <>
              <button className="font-medium text-[var(--accent)] hover:underline">Start</button>
              <button className="text-[var(--muted)] hover:text-[var(--foreground)]">Edit</button>
              <button className="text-[var(--muted)] hover:text-[var(--foreground)]">Skip</button>
            </>
          ) : (
            <button className="font-medium text-[var(--accent)] hover:underline">
              Open session →
            </button>
          )}
          <SyncNote event={event} />
        </div>
      </div>
    </div>
  );
}

function SyncNote({ event }: { event: CalendarEvent }) {
  const sync =
    event.kind === "planned" || event.kind === "completed-planned"
      ? event.planned.google_sync_status
      : null;
  if (!sync) return null;
  if (sync === "failed")
    return (
      <span className="ml-auto text-[12px] text-[var(--danger)]">
        Sync failed · <button className="underline">Resync</button>
      </span>
    );
  return (
    <span className="ml-auto text-[12px] text-[var(--faint)]">
      {sync === "synced" ? "Synced to Google" : "Sync pending"}
    </span>
  );
}

function Body({ event, fg }: { event: CalendarEvent; fg: string }) {
  if (event.kind === "run") return <Stats tiles={runMetrics(event.run)} />;
  if (event.kind === "workout") return <Stats tiles={workoutMetrics(event.workout)} />;
  if (event.kind === "planned" && event.planned.activity_kind === "run") {
    return (
      <div>
        <p className="text-[13px] font-medium" style={{ color: fg }}>
          {runTypeLabel(event.planned.run_type)}
        </p>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--foreground)]/90">
          {event.planned.run_details ?? "An open time block — no agenda set."}
        </p>
      </div>
    );
  }

  const planned =
    event.kind === "planned" || event.kind === "completed-planned" ? event.planned : null;
  if (!planned) return null;
  if (planned.exercises.length === 0)
    return (
      <p className="text-[15px] leading-relaxed text-[var(--muted)]">
        No agenda — a held time block.
      </p>
    );

  const rows = plannedAgenda(planned, exerciseMap);
  return (
    <div>
      <p className="mb-4 text-[12px] uppercase tracking-wide text-[var(--faint)]">Agenda</p>
      <ul className="space-y-4">
        {rows.map((r) => (
          <li key={r.id} className="flex items-baseline justify-between gap-6">
            <span className="min-w-0">
              <span className="text-[15px] text-[var(--foreground)]">{r.name}</span>
              {r.superset != null && (
                <span className="ml-2 text-[11px] uppercase tracking-wide" style={{ color: fg }}>
                  superset
                </span>
              )}
              {r.muscles.length > 0 && (
                <span className="mt-0.5 block text-[12px] text-[var(--faint)]">
                  {r.muscles.join(" · ")}
                </span>
              )}
            </span>
            <span className="shrink-0 text-[13px] tabular-nums text-[var(--muted)]">{r.spec}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Stats({ tiles }: { tiles: MetricTile[] }) {
  return (
    <div className="flex flex-wrap gap-x-12 gap-y-6">
      {tiles.map((t) => (
        <div key={t.label}>
          <p className="text-[12px] uppercase tracking-wide text-[var(--faint)]">{t.label}</p>
          <p className="mt-1.5 text-[24px] font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
            {t.value}
            {t.sub ? (
              <span className="ml-1 text-[12px] font-normal text-[var(--muted)]">{t.sub}</span>
            ) : null}
          </p>
        </div>
      ))}
    </div>
  );
}

function RestDay() {
  return (
    <div className="flex min-h-[220px] items-center px-10 py-16">
      <div className="mx-auto max-w-xl">
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
          Rest day
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">
          Nothing logged or planned.{" "}
          <button className="font-medium text-[var(--accent)] hover:underline">
            Plan a workout →
          </button>
        </p>
      </div>
    </div>
  );
}
