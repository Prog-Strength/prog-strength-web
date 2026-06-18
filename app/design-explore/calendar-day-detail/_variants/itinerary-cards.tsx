"use client";

/**
 * IDIOM: itinerary-cards — draws on Things (Cultured Code).
 *
 * Composition: the left column is a set of calm, soft-rounded ITINERARY
 * CARDS, one per event, with generous internal padding and large tap
 * targets; the right pane is an expanded card with SECTIONED DISCLOSURE
 * (agenda, sets, sync, actions) revealed as tidy blocks. The largest type
 * scale and roomiest spacing of the five — the "glad to open every morning"
 * idiom. Empty/rest day gets a deliberately satisfying treatment here.
 *
 * Divergence axes (within the design system's palette/accent/type):
 *  - type scale: large (15–16px titles, 13px meta) — editorial
 *  - spacing rhythm: roomy (gap-3, p-4 cards, sectioned blocks)
 *  - layout: stacked cards left, expanded sectioned card right
 */

import { useMemo, useState } from "react";
import { activityColors } from "@/lib/activity-colors";
import { disciplineOf } from "@/components/calendar/derivations";
import type { CalendarEvent } from "@/components/calendar/types";
import {
  eventId,
  eventTitle,
  exerciseMap,
  fmtWindow,
  fmtSpan,
  fmtKm,
  lifecycleOf,
  windowOf,
  type Lifecycle,
  type Scenario,
} from "../_fixtures";
import { plannedAgenda, muscleSummary, runMetrics, runTypeLabel, workoutMetrics } from "../_agenda";

const DOT: Record<Lifecycle, string> = { planned: "○", completed: "●", skipped: "⊘", logged: "●" };

export default function ItineraryCards({ scenario }: { scenario: Scenario }) {
  const events = useMemo(
    () => [...scenario.events].sort((a, b) => a.startMs - b.startMs),
    [scenario.events],
  );
  const [selId, setSelId] = useState<string | null>(events[0] ? eventId(events[0]) : null);
  const selected = events.find((e) => eventId(e) === selId) ?? events[0] ?? null;

  if (events.length === 0) return <RestDay />;

  return (
    <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[minmax(300px,380px)_1fr]">
      {/* CARDS */}
      <div className="flex flex-col gap-3">
        {scenario.steps ? (
          <div className="flex items-center gap-2 rounded-[14px] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--muted)]">
            <span className="text-[var(--foreground)]">👟</span>
            <span className="font-medium text-[var(--foreground)]">
              {scenario.steps.toLocaleString("en-US")}
            </span>{" "}
            steps
          </div>
        ) : null}
        {events.map((e) => {
          const c = activityColors(disciplineOf(e));
          const life = lifecycleOf(e);
          const active = eventId(e) === selId;
          const { startIso, endIso } = windowOf(e);
          return (
            <button
              key={eventId(e)}
              type="button"
              onClick={() => setSelId(eventId(e))}
              className={`group rounded-[16px] border bg-[var(--surface)] p-4 text-left transition ${
                active
                  ? "border-transparent ring-2"
                  : "border-[var(--border)] hover:bg-[var(--surface-2)]"
              }`}
              style={
                active ? ({ boxShadow: `0 0 0 2px ${c.dot}` } as React.CSSProperties) : undefined
              }
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden
                  className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[14px]"
                  style={{ backgroundColor: c.bg, color: c.fg }}
                >
                  {DOT[life]}
                </span>
                <div className="min-w-0 flex-1">
                  <h3
                    className={`truncate text-[15px] font-semibold tracking-tight ${
                      life === "skipped"
                        ? "text-[var(--muted)] line-through"
                        : "text-[var(--foreground)]"
                    }`}
                  >
                    {eventTitle(e)}
                  </h3>
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    {fmtWindow(startIso, endIso)}
                  </p>
                  <p className="mt-2 text-[12px]" style={{ color: c.fg }}>
                    {cardTag(e)}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* EXPANDED CARD */}
      <div className="hidden lg:block">{selected && <Expanded event={selected} />}</div>
    </div>
  );
}

function cardTag(e: CalendarEvent): string {
  switch (e.kind) {
    case "planned":
      return e.planned.activity_kind === "run"
        ? runTypeLabel(e.planned.run_type)
        : e.planned.exercises.length
          ? `${e.planned.exercises.length} exercises`
          : "Time block";
    case "completed-planned":
      return "Completed · plan + actuals";
    case "run":
      return `${fmtKm(e.run.distance_meters)} run`;
    case "workout":
      return `${e.workout.exercises.length} exercises logged`;
  }
}

function Expanded({ event }: { event: CalendarEvent }) {
  const c = activityColors(disciplineOf(event));
  const life = lifecycleOf(event);
  const { startIso, endIso } = windowOf(event);

  return (
    <div className="rounded-[16px] border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-start gap-4">
        <span
          aria-hidden
          className="mt-1 h-11 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: c.dot }}
        />
        <div className="min-w-0">
          <h2 className="text-[22px] font-semibold tracking-tight text-[var(--foreground)]">
            {eventTitle(event)}
          </h2>
          <p className="mt-1.5 text-[14px] text-[var(--muted)]">
            {fmtWindow(startIso, endIso)} · {fmtSpan(startIso, endIso)}
          </p>
        </div>
        <span
          className="ml-auto shrink-0 rounded-full px-3 py-1 text-[12px] font-medium capitalize"
          style={{ backgroundColor: c.bg, color: c.fg }}
        >
          {life}
        </span>
      </div>

      <div className="mt-6 space-y-5">
        <Sections event={event} accent={c.dot} fg={c.fg} />
      </div>

      <div className="mt-7 flex items-center gap-2 border-t border-[var(--border)] pt-5">
        {life === "planned" ? (
          <>
            <button className="rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)]">
              Start session
            </button>
            <button className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--foreground)]">
              Edit plan
            </button>
          </>
        ) : (
          <button className="rounded-full border border-[var(--border-strong)] px-4 py-2 text-[13px] font-medium text-[var(--foreground)]">
            View session →
          </button>
        )}
      </div>
    </div>
  );
}

/** Tidy disclosure blocks, each a labeled section card. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[14px] bg-[var(--surface-2)] p-4">
      <h4 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Sections({ event, accent, fg }: { event: CalendarEvent; accent: string; fg: string }) {
  const blocks: React.ReactNode[] = [];

  if (event.kind === "run") {
    blocks.push(
      <Section key="m" title="The session">
        <TileRow tiles={runMetrics(event.run)} fg={fg} />
      </Section>,
    );
  } else if (event.kind === "workout") {
    blocks.push(
      <Section key="m" title="The session">
        <TileRow tiles={workoutMetrics(event.workout)} fg={fg} />
      </Section>,
    );
  } else if (event.kind === "planned" && event.planned.activity_kind === "run") {
    blocks.push(
      <Section key="r" title={runTypeLabel(event.planned.run_type)}>
        <p className="text-[14px] leading-relaxed text-[var(--foreground)]">
          {event.planned.run_details ?? "An open time block."}
        </p>
      </Section>,
    );
  } else {
    const planned =
      event.kind === "planned" || event.kind === "completed-planned" ? event.planned : null;
    if (planned && planned.exercises.length > 0) {
      const rows = plannedAgenda(planned, exerciseMap);
      const muscles = muscleSummary(rows);
      if (muscles.length)
        blocks.push(
          <Section key="muscles" title="Focus">
            <div className="flex flex-wrap gap-2">
              {muscles.map((m) => (
                <span
                  key={m}
                  className="rounded-full px-2.5 py-1 text-[12px]"
                  style={{ backgroundColor: "var(--surface-3)", color: fg }}
                >
                  {m}
                </span>
              ))}
            </div>
          </Section>,
        );
      blocks.push(
        <Section key="agenda" title="Agenda">
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3">
                {r.superset != null && (
                  <span
                    className="h-5 w-0.5 rounded-full"
                    style={{ backgroundColor: accent }}
                    aria-hidden
                  />
                )}
                <span className="min-w-0 flex-1 text-[14px] text-[var(--foreground)]">
                  {r.name}
                </span>
                <span className="shrink-0 text-[13px] tabular-nums text-[var(--muted)]">
                  {r.spec}
                </span>
              </li>
            ))}
          </ul>
        </Section>,
      );
    } else if (planned) {
      blocks.push(
        <Section key="block" title="Plan">
          <p className="text-[14px] text-[var(--muted)]">
            No agenda yet — a held time block for {eventTitle(event)}.
          </p>
        </Section>,
      );
    }
  }

  // sync section for any planned-backed event
  const sync =
    event.kind === "planned" || event.kind === "completed-planned"
      ? event.planned.google_sync_status
      : null;
  if (sync)
    blocks.push(
      <Section key="sync" title="Calendar sync">
        {sync === "failed" ? (
          <p className="text-[13px] text-[var(--danger)]">
            Google sync failed. <button className="font-medium underline">Resync</button>
          </p>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">
            {sync === "synced" ? "Synced to Google Calendar." : "Sync pending…"}
          </p>
        )}
      </Section>,
    );

  return <>{blocks}</>;
}

function TileRow({
  tiles,
  fg,
}: {
  tiles: { label: string; value: string; sub?: string }[];
  fg: string;
}) {
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label}>
          <dt className="text-[11px] uppercase tracking-wide text-[var(--faint)]">{t.label}</dt>
          <dd
            className="mt-1 text-[18px] font-semibold tracking-tight tabular-nums"
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
    <div className="p-5">
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-[16px] border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-[var(--surface-2)] text-[26px]">
          🌙
        </span>
        <p className="text-[17px] font-semibold tracking-tight text-[var(--foreground)]">
          Rest day
        </p>
        <p className="max-w-xs text-[14px] leading-relaxed text-[var(--muted)]">
          Nothing logged or planned. Recovery is part of the program — enjoy it.
        </p>
        <button className="mt-2 rounded-full bg-[var(--accent)] px-4 py-2 text-[13px] font-semibold text-[var(--accent-fg)]">
          Plan a workout →
        </button>
      </div>
    </div>
  );
}
