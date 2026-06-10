"use client";

/**
 * The segmented Lifts / Running control that sits in the header band beside
 * the Customize button. URL-backed: selecting a segment calls
 * `router.replace("/personal-records?view=...")` (replace, not push, so the
 * back button doesn't fill with view-toggle history).
 *
 * Implements the WAI-ARIA tabs pattern: a `role="tablist"` of two
 * `role="tab"` buttons with `aria-selected`. Left/Right arrow keys move
 * focus across the segments (wrapping); Enter/Space activates the focused
 * segment. The active segment gets a surface background + foreground text +
 * accent ring; inactive segments are muted on a transparent background.
 */

import { useRef } from "react";
import { useRouter } from "next/navigation";

export type PRView = "lifts" | "running";

const SEGMENTS: { value: PRView; label: string }[] = [
  { value: "lifts", label: "Lifts" },
  { value: "running", label: "Running" },
];

export function ViewSwitcher({ view }: { view: PRView }) {
  const router = useRouter();
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(next: PRView) {
    router.replace(`/personal-records?view=${next}`);
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + SEGMENTS.length) % SEGMENTS.length;
      buttonRefs.current[nextIndex]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(SEGMENTS[index].value);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="Personal records view"
      className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] p-0.5"
    >
      {SEGMENTS.map((seg, i) => {
        const active = seg.value === view;
        return (
          <button
            key={seg.value}
            ref={(el) => {
              buttonRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => select(seg.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              active
                ? "bg-[var(--surface-2)] text-[var(--foreground)] ring-1 ring-[var(--accent)]"
                : "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {seg.label}
          </button>
        );
      })}
    </div>
  );
}
