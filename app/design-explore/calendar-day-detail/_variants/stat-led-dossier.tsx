"use client";

/**
 * IDIOM: stat-led-dossier — draws on Whoop.
 *
 * Composition: the detail pane LEADS WITH THE NUMBERS as a compact metric
 * dossier (a logged session's actuals; a planned one's target block), then
 * the agenda beneath. The left list is a slim, metric-tinted INDEX — rail ·
 * title · one key number per row. Data-forward, single-accent-on-slate,
 * the tightest information density of the five; the activity hue does
 * double duty as the metric accent (still in-system).
 *
 * Divergence axes (within the design system's palette/accent/type):
 *  - type scale: small labels + oversized tight-tracked stat numerals
 *  - spacing rhythm: tight index rows; a dense metric grid headlines the pane
 *  - layout: slim numeric index left, dossier (stats → agenda) right
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
  fmtSpan,
  fmtKm,
  lifecycleOf,
  windowOf,
  type Lifecycle,
  type Scenario,
} from "../_fixtures";
import {
  plannedAgenda,
  plannedTargets,
  loggedRows,
  runMetrics,
  runTypeLabel,
  workoutMetrics,
  type MetricTile,
} from "../_agenda";

function keyNumber(e: CalendarEvent): string {
  const { startIso, endIso } = windowOf(e);
  switch (e.kind) {
    case "run":
      return fmtKm(e.run.distance_meters);
    case "workout": {
      let sets = 0;
      for (const ex of e.workout.exercises) sets += ex.sets.length;
      return `${sets} sets`;
    }
    case "completed-planned":
      return e.logged.kind === "run"
        ? fmtKm(e.logged.run.distance_meters)
        : fmtSpan(startIso, endIso);
    case "planned":
      return e.planned.activity_kind === "run"
        ? runTypeLabel(e.planned.run_type)
        : fmtSpan(startIso, endIso);
  }
}

const STATUS: Record<Lifecycle, string> = {
  planned: "TARGET",
  completed: "COMPLETED",
  skipped: "SKIPPED",
  logged: "LOGGED",
};

export default function StatLedDossier({ scenario }: { scenario: Scenario }) {
  const events = useMemo(
    () => [...scenario.events].sort((a, b) => a.startMs - b.startMs),
    [scenario.events],
  );
  const [selId, setSelId] = useState<string | null>(events[0] ? eventId(events[0]) : null);
  const selected = events.find((e) => eventId(e) === selId) ?? events[0] ?? null;

  if (events.length === 0) return <RestDay />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[256px_1fr]">
      {/* METRIC INDEX */}
      <div className="border-b border-[var(--border)] lg:border-b-0 lg:border-r">
        {scenario.steps ? (
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">Steps</span>
            <span className="text-[13px] font-semibold tabular-nums text-[var(--foreground)]">
              {scenario.steps.toLocaleString("en-US")}
            </span>
          </div>
        ) : null}
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
              className={`flex w-full items-center gap-2.5 border-b border-[var(--border)] px-3 py-2 text-left transition ${
                active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]/60"
              }`}
            >
              <span
                aria-hidden
                className="h-7 w-1 shrink-0 rounded-full"
                style={{ backgroundColor: c.dot, opacity: life === "skipped" ? 0.4 : 1 }}
              />
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-[12px] font-medium ${
                    life === "skipped"
                      ? "text-[var(--muted)] line-through"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {eventTitle(e)}
                </span>
                <span className="text-[10px] tabular-nums text-[var(--faint)]">
                  {fmtTime(startIso)}
                </span>
              </span>
              <span
                className="shrink-0 text-[12px] font-semibold tabular-nums"
                style={{ color: active ? c.fg : "var(--muted)" }}
              >
                {keyNumber(e)}
              </span>
            </button>
          );
        })}
      </div>

      {/* DOSSIER */}
      <div className="hidden lg:block">{selected && <Dossier event={selected} />}</div>
    </div>
  );
}

function Dossier({ event }: { event: CalendarEvent }) {
  const c = activityColors(disciplineOf(event));
  const life = lifecycleOf(event);
  const { startIso, endIso } = windowOf(event);
  const tiles = dossierTiles(event);

  return (
    <div className="px-7 py-6">
      <div className="flex items-center gap-2">
        <span
          className="rounded-sm px-1.5 py-0.5 text-[10px] font-bold tracking-wider"
          style={{ backgroundColor: c.bg, color: c.fg }}
        >
          {STATUS[life]}
        </span>
        <span className="text-[11px] tabular-nums text-[var(--faint)]">
          {fmtTime(startIso)}–{fmtTime(endIso)} · {fmtSpan(startIso, endIso)}
        </span>
      </div>
      <h3 className="mt-2 text-[18px] font-semibold tracking-tight text-[var(--foreground)]">
        {eventTitle(event)}
      </h3>

      {/* the numbers lead */}
      <div
        className="mt-5 grid gap-px overflow-hidden rounded-[14px] border"
        style={{
          borderColor: "var(--border)",
          gridTemplateColumns: `repeat(${Math.min(tiles.length, 4)}, minmax(0,1fr))`,
          backgroundColor: "var(--border)",
        }}
      >
        {tiles.map((t) => (
          <div key={t.label} className="bg-[var(--surface)] px-4 py-3.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{t.label}</p>
            <p
              className="mt-1 text-[26px] font-bold leading-none tracking-[-0.03em] tabular-nums"
              style={{ color: c.fg }}
            >
              {t.value}
              {t.sub ? (
                <span className="ml-1 align-baseline text-[12px] font-normal text-[var(--muted)]">
                  {t.sub}
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      {/* agenda beneath */}
      <div className="mt-6">
        <AgendaBeneath event={event} accent={c.dot} fg={c.fg} />
      </div>
    </div>
  );
}

function dossierTiles(event: CalendarEvent): MetricTile[] {
  switch (event.kind) {
    case "run":
      return runMetrics(event.run);
    case "workout":
      return workoutMetrics(event.workout);
    case "completed-planned":
      return event.logged.kind === "run"
        ? runMetrics(event.logged.run)
        : workoutMetrics(event.logged.workout);
    case "planned":
      return plannedTargets(event.planned, exerciseMap);
  }
}

function AgendaBeneath({
  event,
  accent,
  fg,
}: {
  event: CalendarEvent;
  accent: string;
  fg: string;
}) {
  // run detail
  if (event.kind === "run") return null;
  if (event.kind === "planned" && event.planned.activity_kind === "run") {
    return (
      <p className="text-[13px] leading-relaxed text-[var(--muted)]">
        {event.planned.run_details ?? "Open time block."}
      </p>
    );
  }

  const planned =
    event.kind === "planned" || event.kind === "completed-planned" ? event.planned : null;
  const logged =
    event.kind === "completed-planned" && event.logged.kind === "workout"
      ? event.logged.workout
      : null;
  const workout = event.kind === "workout" ? event.workout : logged;

  if (planned && planned.exercises.length > 0) {
    const rows = plannedAgenda(planned, exerciseMap);
    const actuals = workout
      ? new Map(loggedRows(workout, exerciseMap).map((r) => [r.id, r]))
      : null;
    return (
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
            <th className="pb-1.5 text-left font-medium">Exercise</th>
            <th className="pb-1.5 text-right font-medium">Target</th>
            {actuals && <th className="pb-1.5 text-right font-medium">Actual</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const act = actuals?.get(r.id);
            return (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="py-1.5 text-[13px] text-[var(--foreground)]">
                  {r.superset != null && (
                    <span
                      className="mr-1.5 inline-block h-3 w-0.5 translate-y-0.5 rounded-full"
                      style={{ backgroundColor: accent }}
                      aria-hidden
                    />
                  )}
                  {r.name}
                  {act?.pr && (
                    <span className="ml-1.5 text-[10px] font-bold" style={{ color: fg }}>
                      PR
                    </span>
                  )}
                </td>
                <td className="py-1.5 text-right text-[12px] tabular-nums text-[var(--muted)]">
                  {r.spec}
                </td>
                {actuals && (
                  <td
                    className="py-1.5 text-right text-[12px] tabular-nums"
                    style={{ color: act ? fg : "var(--faint)" }}
                  >
                    {act ? act.spec : "—"}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
  if (planned)
    return <p className="text-[13px] text-[var(--muted)]">No agenda — a held time block.</p>;
  return null;
}

function RestDay() {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[40px] font-bold leading-none tracking-[-0.03em] text-[var(--surface-3)]">
        0
      </p>
      <p className="text-[13px] text-[var(--muted)]">
        No sessions logged or planned — recovery day.
      </p>
      <button className="mt-2 rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
        Plan a workout →
      </button>
    </div>
  );
}
