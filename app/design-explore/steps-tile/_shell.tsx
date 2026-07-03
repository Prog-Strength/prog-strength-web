/**
 * DxTile — a throwaway stand-in for the dashboard `MiniCard` chrome so each
 * steps-tile variant can be judged at true tile width against the same shell
 * the real card wears: the 14px hairline panel, `p-4` padding, the uppercase
 * `STEPS` title, and the whole-card affordance into `/activities?view=steps`.
 *
 * It intentionally mirrors `_components/mini-card.tsx` rather than importing
 * it: the real MiniCard is a `next/link`, and stacking many of them on one
 * comparison screen (plus rendering the same variant across three fixtures)
 * reads better as static panels. The variant owns everything *inside* this
 * shell — the shell is fixed chrome, per `scope: in-system`.
 */

import type { ReactNode } from "react";

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4";

/** Fixed tile width so every variant is judged at the real one-third grid cell. */
export const TILE_WIDTH = "w-[320px]";

export function DxTile({ children }: { children: ReactNode }) {
  return (
    <div className={`${PANEL} flex flex-col gap-3`}>
      <div className="flex items-center gap-1.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Steps</h3>
      </div>
      {children}
    </div>
  );
}

/**
 * Shared empty state — the fully-empty (`present: false`) tile falls back to
 * the grid's `MiniCardEmpty` CTA, identical for every variant. Shown once on
 * the comparison route rather than per-variant.
 */
export function DxTileEmpty() {
  return (
    <DxTile>
      <div className="flex flex-1 items-center">
        <p className="text-sm text-[var(--muted)]">
          Log your steps to start tracking <span className="text-[var(--accent)]">→</span>
        </p>
      </div>
    </DxTile>
  );
}
