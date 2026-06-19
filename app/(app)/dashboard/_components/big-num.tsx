/**
 * BigNum — the headline figure of a mini-card.
 *
 * A large mono (tabular-numeral) value with tight tracking, optionally
 * trailed by a small muted unit/label suffix on the same baseline. The
 * value is passed pre-formatted (the caller decides compact vs. exact);
 * BigNum only owns the typography.
 */

import type { ReactNode } from "react";

export function BigNum({
  value,
  suffix,
  className,
}: {
  value: ReactNode;
  suffix?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-1 ${className ?? ""}`}>
      <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
        {value}
      </span>
      {suffix != null && <span className="text-xs font-medium text-[var(--muted)]">{suffix}</span>}
    </div>
  );
}
