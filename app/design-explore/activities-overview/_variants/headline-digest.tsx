/**
 * IDIOM: headline-digest — The Overview as an *authored summary* (The Athletic).
 *
 * Spread axes (within the design system — palette/accent/type are fixed):
 *  · Type scale  — DRAMATIC. One enormous lead figure (the consistency line),
 *                  everything else set small as captions/labels. Manrope only.
 *  · Color logic — near-monochrome ink-on-near-black; the periwinkle ACCENT is
 *                  reserved for the single number that matters most (41).
 *                  Discipline hues appear only on the split.
 *  · Spacing     — generous, editorial, single airy column; the page breathes.
 * Promotes: CONSISTENCY, narrated like a training-block feature.
 */
import { consistency, headline, running, split, weeks, fmtHm, fmtPace } from "../_data";

export default function HeadlineDigest() {
  const splitTotal = split.liftMin + split.runMin;
  const liftPct = Math.round((split.liftMin / splitTotal) * 100);

  return (
    <article className="mx-auto max-w-2xl px-2 py-4">
      {/* Eyebrow */}
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--faint)]">
        {headline.windowLabel} · Training block
      </p>

      {/* The authored lead — consistency, narrated. The one accent number. */}
      <h2 className="mt-5 text-[clamp(2.25rem,7vw,3.75rem)] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--foreground)]">
        You showed up{" "}
        <span className="text-[var(--accent)] tabular-nums">{consistency.daysActive}</span> of{" "}
        {consistency.totalDays} days.
      </h2>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--muted)]">
        A {fmtHm(headline.totalMinutes)} quarter across {headline.sessions} sessions —{" "}
        {headline.workouts} lifts and {headline.runs} runs. Your current streak is{" "}
        <span className="font-semibold text-[var(--foreground)] tabular-nums">
          {consistency.currentStreak} days
        </span>
        ; the longest stretch ran {consistency.longestStreak}.
      </p>

      {/* Supporting metrics — small, set-in, three quiet columns. */}
      <dl className="mt-10 grid grid-cols-3 gap-x-6 gap-y-7 border-t border-[var(--border)] pt-7">
        <Metric label="Total time" value={fmtHm(headline.totalMinutes)} />
        <Metric label="Avg session" value={fmtHm(headline.avgSessionMinutes)} />
        <Metric label="Sessions" value={String(headline.sessions)} />
        <Metric label="Mileage" value={`${running.mileageMi} mi`} />
        <Metric label="Avg pace" value={`${fmtPace(running.avgPaceSecPerMi)} /mi`} />
        <Metric label="Avg HR" value={`${running.avgHrBpm} bpm`} />
      </dl>

      {/* Captioned chart 1 — weekly activity, small beneath the lead. */}
      <figure className="mt-12">
        <CaptionLine />
        <figcaption className="mt-3 text-[13px] leading-relaxed text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">Weekly minutes.</span> Lifting
          and running over the block — peaking the week of Jun 1, bottoming out in the rest week
          near May 25.
        </figcaption>
      </figure>

      {/* Captioned chart 2 — discipline split, the only place hues appear. */}
      <figure className="mt-10">
        <div className="flex h-3 w-full overflow-hidden rounded-full">
          <div style={{ width: `${liftPct}%`, background: "var(--discipline-lift-dot)" }} />
          <div style={{ width: `${100 - liftPct}%`, background: "var(--discipline-run-dot)" }} />
        </div>
        <figcaption className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-[var(--muted)]">
          <span>
            <span className="font-semibold text-[var(--discipline-lift-fg)]">
              {fmtHm(split.liftMin)}
            </span>{" "}
            lifting · {liftPct}%
          </span>
          <span>
            <span className="font-semibold text-[var(--discipline-run-fg)]">
              {fmtHm(split.runMin)}
            </span>{" "}
            running · {100 - liftPct}%
          </span>
        </figcaption>
      </figure>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

/** A single calm 1px line — the weekly lifting trend, captioned editorially. */
function CaptionLine() {
  const w = 560;
  const h = 96;
  const lift = weeks.map((wk) => wk.liftMin);
  const run = weeks.map((wk) => wk.runMin);
  const max = Math.max(...lift, ...run, 1);
  const x = (i: number) => (i / (weeks.length - 1)) * w;
  const y = (v: number) => h - (v / max) * (h - 8) - 4;
  const path = (vals: number[]) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" height={h}>
      <path d={path(lift)} fill="none" stroke="var(--discipline-lift-dot)" strokeWidth={1.5} />
      <path
        d={path(run)}
        fill="none"
        stroke="var(--discipline-run-dot)"
        strokeWidth={1.5}
        opacity={0.85}
      />
    </svg>
  );
}
