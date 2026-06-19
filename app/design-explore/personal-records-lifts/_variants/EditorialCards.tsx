"use client";

/**
 * VARIANT 3 / 5 — idiom: editorial-cards
 * ----------------------------------------------------------------------------
 * The card form, elevated. Keeps cards but kills the repeated label furniture
 * (no more CURRENT ESTIMATED 1RM / SET ON / boxed stats). Each card opens with
 * one confident headline — the lift, large — and the PR + estimate read as a
 * single stat LINE: "305 × 2 · est 327 · +22", not two boxed labeled stats.
 *
 *   Draws on : Apple Fitness summary cards + editorial sport layouts — one hero
 *              stat per card, large type, generous spacing, labels demoted.
 *   Type scale: big contrast — oversized lift name & PR figure against faint,
 *              small captions. Hierarchy comes from SIZE, not chrome.
 *   Color logic: neutral; warning/success spent only on the readiness cue —
 *              a hairline top accent whose warmth scales with the gap.
 *   Spacing  : airy, magazine rhythm — generous padding & leading, few cards.
 *
 * Throwaway DX mockup — static fixtures, no data wiring.
 */

import type { PersonalRecord } from "@/lib/api";
import {
  deriveReadiness,
  fmtAgo,
  fmtNum,
  fmtWeight,
  type Readiness,
  type RenderMode,
} from "../_fixtures";

export function EditorialCards({ records, mode }: { records: PersonalRecord[]; mode: RenderMode }) {
  const cards = records.map(deriveReadiness);
  return (
    <div className="flex flex-col">
      <Chrome />
      <div className="px-6 py-8">
        {mode === "error" ? (
          <ErrorState />
        ) : mode === "loading" ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {cards.map((r) => (
              <Card key={r.record.exercise_id} r={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ r }: { r: Readiness }) {
  if (!r.hasPR) {
    return (
      <div className="flex flex-col justify-between gap-6 rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-transparent p-6">
        <h3 className="text-2xl font-semibold tracking-tight text-[var(--muted)]">
          {r.record.exercise_name}
        </h3>
        <div>
          <p className="text-sm text-[var(--faint)]">No record yet.</p>
          <button className="mt-2 text-sm font-medium text-[var(--accent)] transition hover:underline">
            Log your first attempt →
          </button>
        </div>
      </div>
    );
  }

  const pct = r.gapPct ?? 0;
  const fresh = pct < 5;
  const intensity = Math.min(1, pct / 30);

  return (
    <article className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
      {/* readiness cue: a single hairline whose warmth scales with the gap */}
      <div
        className="absolute inset-x-0 top-0 h-0.5"
        style={{
          background: fresh
            ? "var(--discipline-lift-dot)"
            : `color-mix(in srgb, var(--warning) ${40 + intensity * 60}%, transparent)`,
        }}
      />

      <header className="flex items-start justify-between gap-3">
        <h3
          className="text-2xl font-semibold leading-tight tracking-tight"
          title={r.record.exercise_name}
        >
          {r.record.exercise_name}
        </h3>
        {fresh ? (
          <span className="mt-1 shrink-0 text-xs text-[var(--muted)]">freshly tested</span>
        ) : (
          <span
            className="mt-1 shrink-0 text-xs font-semibold tabular-nums"
            style={{ color: "var(--warning)" }}
          >
            {pct.toFixed(0)}% ahead
          </span>
        )}
      </header>

      {/* the hero stat line — PR figure large, the rest demoted inline */}
      <p className="mt-6 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-4xl font-semibold tabular-nums tracking-tight">
          {fmtNum(r.record.weight)}
        </span>
        <span className="text-lg text-[var(--muted)] tabular-nums">
          {r.record.unit} × {r.record.reps}
        </span>
        <span className="text-base text-[var(--faint)]">
          · est {fmtNum(r.record.current_estimated_1rm)}
        </span>
        {!fresh && r.gap !== null && (
          <span className="text-base font-medium tabular-nums text-[var(--success)]">
            · +{fmtNum(r.gap)}
          </span>
        )}
      </p>

      <footer className="mt-6 flex items-center justify-between text-sm text-[var(--faint)]">
        <span>
          Set {fmtAgo(r.daysSince)}
          {r.isDumbbell && " · per dumbbell"}
        </span>
        <button className="text-[var(--muted)] transition hover:text-[var(--foreground)]">
          View workout →
        </button>
      </footer>
    </article>
  );
}

function Chrome() {
  return (
    <div className="flex flex-col gap-3 border-b border-[var(--border)] px-6 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Personal Records</h1>
        <button className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]">
          Customize
        </button>
      </div>
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-medium">
          <span className="rounded-full bg-[var(--surface-2)] px-3 py-1 text-[var(--foreground)] ring-1 ring-[var(--accent)]">
            Lifts
          </span>
          <span className="rounded-full px-3 py-1 text-[var(--muted)]">Running</span>
        </div>
        <p className="text-sm text-[var(--muted)]">Your bests, and how far you’ve pulled ahead.</p>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex flex-col gap-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6"
        >
          <div className="h-7 w-2/3 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-10 w-1/2 animate-pulse rounded bg-[var(--surface-2)]" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function ErrorState() {
  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-4 py-3 text-sm text-[var(--danger)]">
      Couldn’t load your records. Retry?
    </div>
  );
}
