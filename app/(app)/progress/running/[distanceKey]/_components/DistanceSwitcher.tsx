"use client";

/**
 * Segmented pill control for the six standard distances. URL-driven:
 * selecting a pill calls `router.replace("/progress/running/{key}")`
 * (replace, not push, so the back button doesn't fill with switch
 * history), mirroring the personal-records ViewSwitcher.
 *
 * Implements the WAI-ARIA tabs pattern: a `role="tablist"` of
 * `role="tab"` buttons with `aria-selected`. Left/Right arrow keys move
 * focus across the pills (wrapping); Enter/Space activates the focused
 * pill. The active pill gets a surface background + foreground text +
 * accent ring; inactive pills are muted on a transparent background.
 */

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { STANDARD_DISTANCES } from "./distances";

export function DistanceSwitcher({ distanceKey }: { distanceKey: string }) {
  const router = useRouter();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: string) {
    router.replace(`/progress/running/${next}`);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + STANDARD_DISTANCES.length) % STANDARD_DISTANCES.length;
      buttonRefs.current[nextIndex]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(STANDARD_DISTANCES[index].key);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Estimate distance"
      className="inline-flex flex-wrap items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {STANDARD_DISTANCES.map((d, i) => {
        const active = d.key === distanceKey;
        return (
          <button
            key={d.key}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(d.key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-[var(--surface-2)] text-[var(--foreground)] ring-1 ring-[var(--accent)]"
                : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}
