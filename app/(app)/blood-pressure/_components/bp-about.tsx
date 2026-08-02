import { BP_CATEGORIES, type BpCategory } from "@/lib/blood-pressure";

/**
 * Static, factual explainer for the blood-pressure page. No data, no
 * state — just what the two numbers mean, why a *log* (not a single
 * reading) is the useful signal, and the 2017 ACC/AHA classification
 * ladder. Rendered at the bottom of the page in the normal state and
 * promoted above the log CTA in the empty state, where it's the only
 * useful content.
 *
 * The category chips read their status tone from BP_CATEGORIES[cat].tone
 * so they stay in lock-step with the rest of the app's category colors.
 */

type Row = {
  cat: BpCategory;
  systolic: string;
  join: string; // "and" / "or" between the two columns
  diastolic: string;
};

// The ladder rows, most→least common ordering (Normal first, reading
// top→bottom the way the guideline table is usually printed). Copy of
// the ACC/AHA cutoffs; kept as display strings so the ≥ / < glyphs read
// exactly as the guideline states them.
const ROWS: Row[] = [
  { cat: "normal", systolic: "< 120", join: "and", diastolic: "< 80" },
  { cat: "elevated", systolic: "120–129", join: "and", diastolic: "< 80" },
  { cat: "stage_1", systolic: "130–139", join: "or", diastolic: "80–89" },
  { cat: "stage_2", systolic: "≥ 140", join: "or", diastolic: "≥ 90" },
  { cat: "crisis", systolic: "> 180", join: "or", diastolic: "> 120" },
];

export function BpAbout() {
  return (
    <section className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
      <h2 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
        About blood pressure
      </h2>

      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-[var(--muted)]">
        <p>
          Blood pressure is the force of your blood pushing against the walls of your arteries.
          It&apos;s written as two numbers, measured in millimeters of mercury (mmHg).
        </p>

        <dl className="flex flex-col gap-2">
          <div>
            <dt className="font-semibold text-[var(--foreground)]">
              Systolic (the top, larger number)
            </dt>
            <dd>
              The pressure during a heartbeat — while the heart contracts and pushes blood out into
              the body.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-[var(--foreground)]">
              Diastolic (the bottom number)
            </dt>
            <dd>The pressure between beats — while the heart relaxes and refills with blood.</dd>
          </div>
        </dl>

        <p>
          Why monitoring matters: high blood pressure usually has no symptoms, and any single
          reading is noisy — it moves with stress, caffeine, time of day, and how you&apos;re
          sitting. The useful signal is the{" "}
          <span className="font-medium text-[var(--foreground)]">average and trend</span> over
          weeks, which is exactly what a log of readings gives you.
        </p>
      </div>

      {/* Classification table — the 2017 ACC/AHA ladder. */}
      <div className="mt-4 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-[var(--surface-2)] text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--faint)]">
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2 text-right tabular-nums">Systolic</th>
              <th className="px-3 py-2 text-center text-[var(--muted)]"></th>
              <th className="px-3 py-2 text-left tabular-nums">Diastolic</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const tone = BP_CATEGORIES[row.cat].tone;
              return (
                <tr key={row.cat} className="border-t border-[var(--border)]">
                  <td className="px-3 py-2">
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                      style={{
                        color: tone,
                        backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`,
                      }}
                    >
                      {BP_CATEGORIES[row.cat].label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-[var(--foreground)]">
                    {row.systolic}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-[var(--muted)]">{row.join}</td>
                  <td className="px-3 py-2 text-left tabular-nums text-[var(--foreground)]">
                    {row.diastolic}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-[var(--faint)]">
        Thresholds follow the 2017 ACC/AHA guideline (mmHg).
      </p>

      <p className="mt-4 text-xs leading-relaxed text-[var(--muted)]">
        This is general information, not medical advice, and your readings are not a diagnosis. Talk
        to a clinician about your numbers.
      </p>
    </section>
  );
}
