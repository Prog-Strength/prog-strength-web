"use client";

/**
 * IDIOM: timeline-spine — draws on Fantastical / Google Calendar day view.
 *
 * Composition: the left "list" is a vertical TIME SPINE — hour ticks with
 * each event drawn as a block positioned and sized by its scheduled window
 * (or logged duration). The visible hour window CLAMPS to the event range
 * ± 1h padding, so a 2-event day never renders a dead 24-hour ribbon. The
 * right pane details the selected block. This is the only idiom where
 * vertical position encodes *when*.
 *
 * Divergence axes (within the design system's palette/accent/type):
 *  - type scale: quiet, numeric-forward — time labels lead
 *  - spacing rhythm: driven by the time axis (px-per-hour), not by cards
 *  - layout: hour gutter + proportional blocks, detail pane on the right
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
  type Scenario,
} from "../_fixtures";
import { plannedAgenda, runMetrics, runTypeLabel, workoutMetrics } from "../_agenda";

const PX_PER_HOUR = 56;

function hourOf(iso: string): number {
  const d = new Date(iso);
  return d.getUTCHours() + d.getUTCMinutes() / 60;
}

export default function TimelineSpine({ scenario }: { scenario: Scenario }) {
  const events = useMemo(
    () => [...scenario.events].sort((a, b) => a.startMs - b.startMs),
    [scenario.events],
  );
  const [selId, setSelId] = useState<string | null>(events[0] ? eventId(events[0]) : null);
  const selected = events.find((e) => eventId(e) === selId) ?? events[0] ?? null;

  const { startHour, endHour } = useMemo(() => {
    if (events.length === 0) return { startHour: 8, endHour: 18 };
    let lo = 24;
    let hi = 0;
    for (const e of events) {
      const { startIso, endIso } = windowOf(e);
      lo = Math.min(lo, hourOf(startIso));
      hi = Math.max(hi, hourOf(endIso));
    }
    // clamp to event range ± 1h padding, snapped to whole hours
    return { startHour: Math.max(0, Math.floor(lo) - 1), endHour: Math.min(24, Math.ceil(hi) + 1) };
  }, [events]);

  if (events.length === 0) return <RestDay />;

  const ticks: number[] = [];
  for (let h = startHour; h <= endHour; h += 1) ticks.push(h);
  const railHeight = (endHour - startHour) * PX_PER_HOUR;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr]">
      {/* TIME SPINE */}
      <div className="border-b border-[var(--border)] py-3 pl-2 pr-3 lg:border-b-0 lg:border-r">
        <div className="relative" style={{ height: railHeight }}>
          {/* hour ticks */}
          {ticks.map((h) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-start"
              style={{ top: (h - startHour) * PX_PER_HOUR }}
            >
              <span className="w-12 shrink-0 -translate-y-1.5 text-right text-[10px] tabular-nums text-[var(--faint)] pr-2">
                {labelHour(h)}
              </span>
              <span className="mt-0 h-px flex-1 bg-[var(--border)]" />
            </div>
          ))}
          {/* event blocks */}
          {events.map((e) => {
            const c = activityColors(disciplineOf(e));
            const life = lifecycleOf(e);
            const { startIso, endIso } = windowOf(e);
            const top = (hourOf(startIso) - startHour) * PX_PER_HOUR;
            const height = Math.max(26, (hourOf(endIso) - hourOf(startIso)) * PX_PER_HOUR - 3);
            const active = eventId(e) === selId;
            return (
              <button
                key={eventId(e)}
                type="button"
                onClick={() => setSelId(eventId(e))}
                className="absolute left-12 right-0 overflow-hidden rounded-md border pl-2 pr-2 text-left transition"
                style={{
                  top,
                  height,
                  backgroundColor: c.bg,
                  borderColor: active ? c.dot : "var(--border)",
                  borderStyle: life === "skipped" ? "dashed" : "solid",
                  borderLeftWidth: 3,
                  borderLeftColor: c.dot,
                  opacity: life === "skipped" ? 0.6 : 1,
                  boxShadow: active ? `0 0 0 1px ${c.dot}` : "none",
                }}
              >
                <span className="flex h-full flex-col justify-center py-1">
                  <span
                    className={`truncate text-[12px] font-medium leading-tight ${
                      life === "skipped" ? "line-through" : ""
                    }`}
                    style={{ color: c.fg }}
                  >
                    {eventTitle(e)}
                  </span>
                  {height > 34 && (
                    <span
                      className="truncate text-[10px] tabular-nums"
                      style={{ color: c.fg, opacity: 0.75 }}
                    >
                      {fmtTime(startIso)} · {fmtSpan(startIso, endIso)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* DETAIL */}
      <div className="hidden lg:block">{selected && <Detail event={selected} />}</div>
    </div>
  );
}

function labelHour(h: number): string {
  if (h === 0 || h === 24) return "12a";
  if (h === 12) return "12p";
  return h < 12 ? `${h}a` : `${h - 12}p`;
}

function Detail({ event }: { event: CalendarEvent }) {
  const c = activityColors(disciplineOf(event));
  const life = lifecycleOf(event);
  const { startIso, endIso } = windowOf(event);

  return (
    <div className="px-7 py-6">
      {/* time leads */}
      <p className="text-[13px] font-medium tabular-nums" style={{ color: c.fg }}>
        {fmtWindow(startIso, endIso)}
      </p>
      <h3 className="mt-1 text-[19px] font-semibold tracking-tight text-[var(--foreground)]">
        {eventTitle(event)}
      </h3>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        {fmtSpan(startIso, endIso)} · {STATUS[life]}
      </p>

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <DetailBody event={event} fg={c.fg} />
      </div>
    </div>
  );
}

const STATUS: Record<string, string> = {
  planned: "Planned",
  completed: "Completed",
  skipped: "Skipped",
  logged: "Logged",
};

function DetailBody({ event, fg }: { event: CalendarEvent; fg: string }) {
  if (event.kind === "run") {
    return <Metrics tiles={runMetrics(event.run)} fg={fg} />;
  }
  if (event.kind === "workout") {
    return <Metrics tiles={workoutMetrics(event.workout)} fg={fg} />;
  }
  if (event.kind === "planned" && event.planned.activity_kind === "run") {
    return (
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-wide text-[var(--faint)]">
          {runTypeLabel(event.planned.run_type)}
        </p>
        <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
          {event.planned.run_details ?? "Open time block."}
        </p>
      </div>
    );
  }
  const planned =
    event.kind === "planned" || event.kind === "completed-planned" ? event.planned : null;
  if (!planned) return null;
  if (planned.exercises.length === 0)
    return <p className="text-[14px] text-[var(--muted)]">No agenda — a held time block.</p>;
  const rows = plannedAgenda(planned, exerciseMap);
  return (
    <ol className="space-y-2.5">
      {rows.map((r, i) => (
        <li key={r.id} className="flex items-baseline gap-3">
          <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-[var(--faint)]">
            {i + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-[14px] text-[var(--foreground)]">{r.name}</span>
            {r.superset != null && (
              <span className="ml-2 text-[10px] uppercase tracking-wide" style={{ color: fg }}>
                superset
              </span>
            )}
          </span>
          <span className="shrink-0 text-[12px] tabular-nums text-[var(--muted)]">{r.spec}</span>
        </li>
      ))}
    </ol>
  );
}

function Metrics({
  tiles,
  fg,
}: {
  tiles: { label: string; value: string; sub?: string }[];
  fg: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label}>
          <dt className="text-[10px] uppercase tracking-wide text-[var(--faint)]">{t.label}</dt>
          <dd
            className="mt-1 text-[22px] font-semibold tracking-tight tabular-nums"
            style={{ color: fg }}
          >
            {t.value}
            {t.sub ? (
              <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">{t.sub}</span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function RestDay() {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <p className="text-[13px] tabular-nums text-[var(--faint)]">— no blocks —</p>
      <p className="text-[14px] font-medium text-[var(--foreground)]">A clear day.</p>
      <button className="mt-2 rounded-full border border-[var(--border-strong)] px-3.5 py-1.5 text-[12px] font-medium text-[var(--foreground)]">
        Plan a workout →
      </button>
    </div>
  );
}
