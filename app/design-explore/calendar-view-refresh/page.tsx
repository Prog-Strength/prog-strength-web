/**
 * DESIGN EXPLORATION (DX) — calendar-view-refresh
 * ==================================================================
 * THROWAWAY comparison route. Renders four genuinely different compositions
 * of the calendar surface side by side so a human can pick a direction. This
 * is NOT production: it is gated behind NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE and
 * 404s when the flag is off, so it is unreachable in normal navigation and
 * dead in production. It is never linked from the app shell / sidebar.
 *
 * Each variant is a self-contained, throwaway component under _components/.
 * Duplication between them is intentional — the value of a DX is the spread,
 * not shared abstraction. All four are in-system: slate ramp + violet accent
 * + Nunito; they diverge only on layout / structure / density / composition.
 */
"use client";

import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { HUE } from "./_components/fixtures";
import { RunGlyph, LiftGlyph, ClockGlyph, CheckGlyph } from "./_components/icons";
import { VariantTrueMonthGrid } from "./_components/VariantTrueMonthGrid";
import { VariantWeekBandRows } from "./_components/VariantWeekBandRows";
import { VariantAgendaHybrid } from "./_components/VariantAgendaHybrid";
import { VariantPanelDriven } from "./_components/VariantPanelDriven";

const VARIANTS = [
  {
    id: "true-month-grid",
    n: 1,
    name: "true-month-grid",
    draws: "Google Calendar / Fantastical — strict month-bounded grid, quiet inline stepper",
    distinct:
      "Small even type · frugal near-mono color (violet only on today/selected) · tight gridded rhythm · rollup as a slim 7th column",
    Component: VariantTrueMonthGrid,
  },
  {
    id: "week-band-rows",
    n: 2,
    name: "week-band-rows",
    draws: "Whoop — coaching tone, the “you trained N of 7” summary as a first-class element",
    distinct:
      "Larger comfortable type · violet on streak dots + selected-week ring · airy one-week-per-band rhythm · digest under its band",
    Component: VariantWeekBandRows,
  },
  {
    id: "agenda-hybrid",
    n: 3,
    name: "agenda-hybrid",
    draws: "Notion Calendar / Fantastical sidebar — mini-grid + dominant agenda column",
    distinct:
      "Dramatic type contrast (tiny numerals vs large rows) · quiet mini-grid, tonal-hue agenda · two-column rhythm · the agenda IS the day detail",
    Component: VariantAgendaHybrid,
  },
  {
    id: "panel-driven",
    n: 4,
    name: "panel-driven",
    draws:
      "Linear — docked right panel replacing modals, crisp section headers, restrained form controls",
    distinct:
      "Even grid + persistent right column · violet anchors the panel header/action · no overlays — day, detail & edit all live in the panel",
    Component: VariantPanelDriven,
  },
] as const;

function Legend() {
  return (
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold"
      style={{ color: "var(--muted)" }}
    >
      <span
        className="text-[10px] font-bold uppercase tracking-wider"
        style={{ color: "var(--faint)" }}
      >
        Tri-state, re-toned (not orange):
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded"
          style={{ background: HUE.lift.bg, color: HUE.lift.fg }}
        >
          <LiftGlyph s={11} />
        </span>
        Logged lift
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded"
          style={{ background: HUE.run.bg, color: HUE.run.fg }}
        >
          <RunGlyph s={11} />
        </span>
        Logged run
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded border border-dashed"
          style={{ borderColor: HUE.lift.line, color: HUE.lift.fg }}
        >
          <ClockGlyph s={11} />
        </span>
        Planned (dashed + clock)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded"
          style={{ background: HUE.lift.bg, color: HUE.lift.fg }}
        >
          <CheckGlyph s={11} />
        </span>
        Completed-from-plan (check)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: "var(--accent)" }} />
        Violet = today / selected / primary
      </span>
    </div>
  );
}

export default function CalendarViewRefreshDX() {
  if (!config.enableDesignExplore) notFound();

  return (
    <main
      className="min-h-screen px-6 py-8"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <div className="mx-auto max-w-[1180px]">
        {/* DX banner */}
        <div
          className="rounded-3xl p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                border: "1px solid var(--accent-line)",
              }}
            >
              Design Exploration · DO NOT MERGE
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              scope: in-system
            </span>
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: "var(--surface-2)", color: "var(--muted)" }}
            >
              4 variants
            </span>
          </div>
          <h1 className="mt-3 text-[26px] font-extrabold leading-tight">calendar-view-refresh</h1>
          <p
            className="mt-1.5 max-w-[760px] text-[13px] font-semibold leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            A second pass at the monthly training calendar — re-toning the orange holdout into the
            app&apos;s slate/violet system, stopping the grid at the month boundary, rethinking
            month navigation, and finishing the day detail and its view/edit surfaces. Four
            compositions of the same fixture (June 2026) so the winner can be picked. Each variant
            uses the same tokens and diverges only on layout, density, navigation, and where the
            detail &amp; edit flow live.
          </p>
          <div className="mt-4">
            <Legend />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {VARIANTS.map((v) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full px-3 py-1.5 text-[11.5px] font-bold"
                style={{
                  background: "var(--surface-2)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {v.n}. {v.name}
              </a>
            ))}
          </div>
        </div>

        {/* Variants stacked, each in its own scoped frame */}
        <div className="mt-8 flex flex-col gap-10">
          {VARIANTS.map((v) => {
            const Component = v.Component;
            return (
              <section key={v.id} id={v.id} className="scroll-mt-6">
                <div className="mb-3 flex items-baseline gap-3">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-extrabold"
                    style={{ background: "var(--accent)", color: "var(--accent-fg)" }}
                  >
                    {v.n}
                  </span>
                  <div>
                    <h2 className="text-[18px] font-extrabold leading-none">{v.name}</h2>
                    <p
                      className="mt-1.5 text-[11.5px] font-semibold"
                      style={{ color: "var(--muted)" }}
                    >
                      <span style={{ color: "var(--foreground)" }}>Draws on:</span> {v.draws}
                    </p>
                    <p
                      className="mt-0.5 text-[11.5px] font-semibold"
                      style={{ color: "var(--muted)" }}
                    >
                      <span style={{ color: "var(--foreground)" }}>Distinct:</span> {v.distinct}
                    </p>
                  </div>
                </div>
                {/* relative + overflow-hidden so each variant's scoped modals/panels stay inside its own frame */}
                <div
                  className="relative overflow-hidden rounded-3xl p-5"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--border-strong)",
                    boxShadow: "var(--shadow-soft)",
                  }}
                >
                  <Component />
                </div>
              </section>
            );
          })}
        </div>

        <footer
          className="mt-12 rounded-2xl p-4 text-[11.5px] font-semibold"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--faint)",
          }}
        >
          Disposable exploration on a throwaway branch. Never merged — the chosen variant is
          reimplemented by a downstream SOW, production-quality, conforming to the design system.
        </footer>
      </div>
    </main>
  );
}
