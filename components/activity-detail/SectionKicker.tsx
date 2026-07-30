/**
 * A tiny uppercase, wide-tracked section label in a discipline hue — the
 * shared register for the body beats ("The Miles", "Time in heart-rate zones"),
 * echoing workout detail's section headings. Defaults to the run discipline
 * (`--discipline-run-dot`); pass `discipline="hike"` to retone it to
 * `--discipline-hike-dot` (the hiking detail page). Tokens only — literal
 * Tailwind classes so the scanner generates the utilities.
 */
const DISCIPLINE_HUE: Record<"run" | "hike", string> = {
  run: "text-[var(--discipline-run-dot)]",
  hike: "text-[var(--discipline-hike-dot)]",
};

export function SectionKicker({
  children,
  discipline = "run",
}: {
  children: React.ReactNode;
  discipline?: "run" | "hike";
}) {
  return (
    <p
      className={`text-[11px] font-semibold uppercase tracking-wider ${DISCIPLINE_HUE[discipline]}`}
    >
      {children}
    </p>
  );
}
