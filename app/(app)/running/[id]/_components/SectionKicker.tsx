/**
 * A tiny uppercase, wide-tracked section label in the run-discipline hue — the
 * shared register for the body beats ("The Miles", "Time in heart-rate zones"),
 * echoing workout detail's section headings. Tokens only:
 * `--discipline-run-dot`.
 */
export function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--discipline-run-dot)]">
      {children}
    </p>
  );
}
