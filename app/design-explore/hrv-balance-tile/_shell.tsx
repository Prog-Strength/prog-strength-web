/**
 * MockCard — a throwaway stand-in for the real dashboard `MiniCard` shell.
 *
 * Replicates MiniCard's visible chrome (14px hairline panel, `p-4`, the
 * uppercase muted title, the `gap-3` body stack) WITHOUT the whole-card
 * `next/link`, so the comparison route never navigates when a reviewer clicks a
 * variant. The real tile keeps the link, and every variant here composes only
 * the card BODY — the title and padding are chrome it inherits.
 *
 * Every variant renders under the same `HRV BALANCE` title: unlike the
 * recovery-tile DX, this one rebuilds a single existing tile, so the catalog
 * entry is fixed and the spread is entirely in the body.
 */

import type { ReactNode } from "react";

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4";

export function MockCard({ children }: { children: ReactNode }) {
  return (
    <div className={`${PANEL} flex flex-col gap-3`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        HRV Balance
      </h3>
      {children}
    </div>
  );
}

/**
 * The shared calibrating body — nine nights in, nothing derived yet.
 *
 * Deliberately NOT differentiated per idiom: with no baseline there is no band,
 * no drift and no z, so there is nothing for a composition to compose. Five
 * different renderings of "we don't know yet" would be noise in the spread, and
 * the shipped tile's honest n-of-14 progress state already answers it. Each
 * variant calls this rather than inventing a chart frame around nothing.
 */
export function CalibratingBody({ nights }: { nights: number }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (nights / 14) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] leading-snug text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">{nights} of 14</span> nights ·
        your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}
