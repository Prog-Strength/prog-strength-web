// app/(app)/settings/_components/primitives.tsx
import type { ReactNode } from "react";

/** Shared input surface — rounded slate fill, hairline border, accent focus ring. */
export const inputClass =
  "rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--foreground)] transition placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-line)] disabled:opacity-60";

/** A titled, rounded card: bold section title over a divider, padded body. */
export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <h2 className="border-b border-[var(--border)] px-5 py-3 text-sm font-bold tracking-tight">
        {title}
      </h2>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
    </section>
  );
}

/** A quiet uppercase-faint label over a control, with an optional muted hint. */
export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={htmlFor}
        className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]"
      >
        {label}
      </label>
      {children}
      {hint != null && <p className="text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  );
}
