"use client";

/**
 * IDIOM: inbox-triage — draws on Superhuman.
 *
 * Composition: a dense, uniform-height triage list on the left (rail ·
 * title · time · terse meta, hairline separators, no card fills) tuned for
 * fast top-to-bottom scanning, and a focused "opened item" reading pane on
 * the right with a PINNED ACTION ROW at the bottom (Edit / Start / Skip ·
 * Resync). Tight type scale, hairline separators, generous pane.
 *
 * Divergence axes (within the design system's palette/accent/type):
 *  - type scale: tight (11–13px list, quiet pane meta line)
 *  - spacing rhythm: uniform compact rows; pane is roomy with a fixed footer
 *  - layout: fixed 300px triage column, focused single-pane reader
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
  fmtClock,
  fmtKm,
  lifecycleOf,
  windowOf,
  type Lifecycle,
  type Scenario,
} from "../_fixtures";
import { loggedRows, plannedAgenda, runMetrics, runTypeLabel } from "../_agenda";

const STATUS_TEXT: Record<Lifecycle, string> = {
  planned: "Planned",
  completed: "Done",
  skipped: "Skipped",
  logged: "Logged",
};

function metaLine(e: CalendarEvent): string {
  const { startIso, endIso } = windowOf(e);
  switch (e.kind) {
    case "planned":
      return e.planned.activity_kind === "run"
        ? `${runTypeLabel(e.planned.run_type)} · ${fmtSpan(startIso, endIso)}`
        : `${e.planned.exercises.length || "No"} exercise${e.planned.exercises.length === 1 ? "" : "s"} · ${fmtSpan(startIso, endIso)}`;
    case "completed-planned":
      return `Completed · ${fmtSpan(startIso, endIso)}`;
    case "run":
      return `${fmtKm(e.run.distance_meters)} · ${fmtClock(e.run.duration_seconds)}`;
    case "workout":
      return `${e.workout.exercises.length} exercises`;
  }
}

export default function InboxTriage({ scenario }: { scenario: Scenario }) {
  const events = useMemo(
    () => [...scenario.events].sort((a, b) => a.startMs - b.startMs),
    [scenario.events],
  );
  const [selId, setSelId] = useState<string | null>(events[0] ? eventId(events[0]) : null);
  const selected = events.find((e) => eventId(e) === selId) ?? events[0] ?? null;

  if (events.length === 0) return <RestDay />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr]">
      {/* TRIAGE LIST */}
      <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
        {scenario.steps ? (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3.5 py-2 text-[11px] uppercase tracking-wide text-[var(--faint)]">
            <span>{events.length} sessions</span>
            <span className="tabular-nums">{scenario.steps.toLocaleString("en-US")} steps</span>
          </div>
        ) : null}
        <ul>
          {events.map((e) => {
            const c = activityColors(disciplineOf(e));
            const life = lifecycleOf(e);
            const active = eventId(e) === selId;
            const { startIso } = windowOf(e);
            return (
              <li key={eventId(e)}>
                <button
                  type="button"
                  onClick={() => setSelId(eventId(e))}
                  className={`flex w-full items-center gap-2.5 border-b border-[var(--border)] px-3.5 py-2.5 text-left transition ${
                    active ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-8 w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: c.dot, opacity: life === "skipped" ? 0.4 : 1 }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[13px] font-medium ${
                          life === "skipped"
                            ? "text-[var(--muted)] line-through"
                            : "text-[var(--foreground)]"
                        }`}
                      >
                        {eventTitle(e)}
                      </span>
                      <span className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                        {fmtTime(startIso)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-[var(--faint)]">
                      {metaLine(e)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* FOCUSED READER */}
      <div className="hidden lg:block">{selected && <Reader event={selected} />}</div>
    </div>
  );
}

function Reader({ event }: { event: CalendarEvent }) {
  const c = activityColors(disciplineOf(event));
  const life = lifecycleOf(event);
  const { startIso, endIso } = windowOf(event);

  return (
    <div className="flex h-full min-h-[440px] flex-col">
      <div className="flex-1 px-7 py-6">
        {/* title block */}
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="mt-1 h-9 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: c.dot }}
          />
          <div className="min-w-0">
            <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
              {eventTitle(event)}
            </h3>
            <p className="mt-1 text-[12px] text-[var(--muted)]">
              <span
                className="mr-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                {STATUS_TEXT[life]}
              </span>
              {fmtWindow(startIso, endIso)} · {fmtSpan(startIso, endIso)}
            </p>
          </div>
        </div>

        {/* body */}
        <div className="mt-6">
          <ReaderBody event={event} accent={c.dot} />
        </div>
      </div>

      {/* pinned action row */}
      <div className="flex items-center gap-2 border-t border-[var(--border)] bg-[var(--surface)]/40 px-7 py-3">
        {life === "planned" ? (
          <>
            <button className="rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)]">
              Start
            </button>
            <button className="rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
              Edit
            </button>
            <button className="rounded-full px-2.5 py-1.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--foreground)]">
              Skip
            </button>
          </>
        ) : (
          <button className="rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
            Open session →
          </button>
        )}
        <span className="ml-auto">
          <SyncTag event={event} />
        </span>
      </div>
    </div>
  );
}

function SyncTag({ event }: { event: CalendarEvent }) {
  const sync =
    event.kind === "planned" || event.kind === "completed-planned"
      ? event.planned.google_sync_status
      : null;
  if (!sync) return null;
  if (sync === "failed")
    return (
      <button className="text-[11px] font-medium text-[var(--danger)] hover:underline">
        Sync failed · Resync
      </button>
    );
  const label = sync === "synced" ? "Synced to Google" : "Sync pending";
  return <span className="text-[11px] text-[var(--faint)]">{label}</span>;
}

function ReaderBody({ event, accent }: { event: CalendarEvent; accent: string }) {
  if (event.kind === "run") {
    const m = runMetrics(event.run);
    return (
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        {m.map((t) => (
          <div key={t.label}>
            <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{t.label}</dt>
            <dd className="mt-0.5 text-[20px] font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
              {t.value}
              {t.sub ? (
                <span className="ml-1 text-[12px] font-normal text-[var(--muted)]">{t.sub}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (event.kind === "planned" && event.planned.activity_kind === "run") {
    return (
      <div>
        <p className="text-[11px] uppercase tracking-wide text-[var(--faint)]">Session</p>
        <p className="mt-1 text-[14px] text-[var(--foreground)]">
          {event.planned.run_details ?? "No details."}
        </p>
      </div>
    );
  }

  // lift agenda (planned or completed-planned) — terse rows, supersets indented
  const planned =
    event.kind === "planned" || event.kind === "completed-planned" ? event.planned : null;
  const logged =
    event.kind === "completed-planned" && event.logged.kind === "workout"
      ? event.logged.workout
      : null;
  if (planned && planned.exercises.length === 0)
    return <p className="text-[14px] text-[var(--muted)]">No agenda — open time block.</p>;
  if (!planned) return null;

  const rows = plannedAgenda(planned, exerciseMap);
  const actuals = logged ? new Map(loggedRows(logged, exerciseMap).map((r) => [r.id, r])) : null;
  return (
    <div>
      <p className="mb-2 text-[11px] uppercase tracking-wide text-[var(--faint)]">
        Agenda {actuals ? "· planned vs logged" : ""}
      </p>
      <ul className="divide-y divide-[var(--border)]">
        {rows.map((r) => {
          const act = actuals?.get(r.id);
          return (
            <li key={r.id} className="flex items-center gap-3 py-2">
              {r.superset != null && (
                <span
                  className="h-4 w-0.5 rounded-full"
                  style={{ backgroundColor: accent }}
                  aria-hidden
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--foreground)]">
                {r.name}
              </span>
              <span className="shrink-0 text-[12px] tabular-nums text-[var(--muted)]">
                {r.spec}
              </span>
              {act && (
                <span className="shrink-0 text-[12px] tabular-nums text-[var(--success)]">
                  → {act.spec}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RestDay() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[14px] font-medium text-[var(--foreground)]">Inbox zero — rest day.</p>
      <p className="text-[12px] text-[var(--muted)]">Nothing logged or planned.</p>
      <button className="mt-2 rounded-full bg-[var(--accent)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--accent-fg)]">
        Plan a workout →
      </button>
    </div>
  );
}
