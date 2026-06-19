/**
 * MetaRow — a compact hairline meta line under a card headline.
 *
 * Renders an array of label/value pairs as a single dot-separated row:
 * a muted label, a mono tabular-numeral value, repeated, divided by faint
 * middots. Pairs whose value is null/undefined are dropped so a partial
 * section degrades to just the facts it has rather than showing blanks.
 */

import type { ReactNode } from "react";

export type MetaItem = { label: string; value: ReactNode };

export function MetaRow({ items, className }: { items: MetaItem[]; className?: string }) {
  const shown = items.filter(
    (it) => it.value !== null && it.value !== undefined && it.value !== "",
  );
  if (shown.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs ${className ?? ""}`}>
      {shown.map((it, i) => (
        <span key={it.label} className="flex items-center gap-1">
          {i > 0 && <span className="text-[var(--faint)]">·</span>}
          <span className="text-[var(--muted)]">{it.label}</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">{it.value}</span>
        </span>
      ))}
    </div>
  );
}
