/**
 * Two SHORT dashboard tiles, for scale only — THROWAWAY.
 *
 * `TileGrid` has no span support: uniform thirds, `gap-3`, auto rows. So a
 * taller Resting HR tile makes its whole dashboard row taller, including
 * unrelated tiles beside it, and comparing the five variants only against each
 * other hides that completely. Each variant is therefore also shown in a real
 * three-column row next to these two, and the empty space under them IS what
 * that variant's height costs.
 *
 * The ticket's budget: ~180px of card body, ~260px ceiling. The shipped
 * `recovery_log` lands at ~154px.
 *
 * Deliberately not the real Steps or Weather tiles — importing those would drag
 * their data contracts into a mockup. Same shell, same register, static copy.
 */

import { MiniCard } from "@/app/(app)/dashboard/_components/mini-card";

export function StepsTile() {
  return (
    <MiniCard title="Steps" href="/dashboard">
      <div>
        <p className="text-3xl tabular-nums tracking-[-0.03em] text-[var(--foreground)]">8,412</p>
        <p className="mt-1 text-xs text-[var(--muted)]">of 10,000 · 84%</p>
      </div>
      <div className="h-1 rounded-full bg-[var(--surface-2)]">
        <div className="h-1 w-[84%] rounded-full bg-[var(--accent)]" />
      </div>
    </MiniCard>
  );
}

export function WeatherTile() {
  return (
    <MiniCard title="Weather" href="/dashboard">
      <div>
        <p className="text-3xl tabular-nums tracking-[-0.03em] text-[var(--foreground)]">21°</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Clear · feels 20° · wind 8 km/h</p>
      </div>
    </MiniCard>
  );
}
