"use client";

/**
 * The filter header: five movement-pattern pills (Push / Pull / Legs /
 * Core / All) over a row of date-range chips (30d / 60d / 90d). Replaces
 * the prior twelve muscle-group chips — the rollup to a pattern is done in
 * the API, so the page only ever asks for one of five patterns.
 *
 * The active pattern pill uses a NEUTRAL accent style (no per-muscle hue):
 * "Push" has no established color. URL-backed — selecting either control
 * calls router.replace so the back button doesn't fill with toggle history.
 *
 * The five pills sit in a role="group" and carry aria-pressed; arrow keys
 * move focus across them (WAI-ARIA-ish roving traversal, wrapping).
 */

import { useRef } from "react";
import { useRouter } from "next/navigation";

export type Pattern = "push" | "pull" | "legs" | "core" | "all";
export type Days = 30 | 60 | 90;

const PATTERNS: { value: Pattern; label: string }[] = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "legs", label: "Legs" },
  { value: "core", label: "Core" },
  { value: "all", label: "All" },
];

const DAYS: { value: Days; label: string }[] = [
  { value: 30, label: "30d" },
  { value: 60, label: "60d" },
  { value: 90, label: "90d" },
];

export function MovementPatternFilter({ pattern, days }: { pattern: Pattern; days: Days }) {
  const router = useRouter();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function navigate(nextPattern: Pattern, nextDays: Days) {
    router.replace(`/progress?pattern=${nextPattern}&days=${nextDays}`);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + PATTERNS.length) % PATTERNS.length;
      buttonRefs.current[nextIndex]?.focus();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Movement pattern" className="flex flex-wrap gap-1.5">
        {PATTERNS.map((p, i) => {
          const active = p.value === pattern;
          return (
            <button
              key={p.value}
              ref={(el) => {
                buttonRefs.current[i] = el;
              }}
              type="button"
              onClick={() => navigate(p.value, days)}
              onKeyDown={(e) => onKeyDown(e, i)}
              aria-pressed={active}
              tabIndex={active ? 0 : -1}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--foreground)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {DAYS.map((d) => {
          const active = d.value === days;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => navigate(pattern, d.value)}
              className={`rounded-full px-3 py-1 text-xs transition ${
                active
                  ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              Last {d.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
