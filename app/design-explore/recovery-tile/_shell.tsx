/**
 * MockCard — a throwaway stand-in for the real dashboard `MiniCard` shell.
 *
 * Replicates MiniCard's visible chrome (14px hairline panel, `p-4`, the
 * uppercase muted title) WITHOUT the whole-card `next/link`, so the comparison
 * route never navigates when a reviewer clicks a variant. The real tile keeps
 * the link; this is a mockup harness only. Each variant carries its OWN title
 * (per the DX's composition constraint — these are candidate catalog tiles, not
 * five cards titled RECOVERY), so the title is a prop here.
 */

import type { ReactNode } from "react";

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4";

export function MockCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={`${PANEL} flex flex-col gap-3`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
      {children}
    </div>
  );
}
