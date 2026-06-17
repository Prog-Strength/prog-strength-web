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

/** Full-pill segmented control: active = accent fill, inactive = muted. */
export function SegmentedToggle<T extends string>({
  value,
  options,
  onChange,
  disabled = false,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--background)] p-0.5"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(opt.value);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
