/**
 * WindowStrip — register 2 of `/recovery`, and the page's orientation.
 *
 * Four quiet cells under the window control: score, resting HR and HRV averaged
 * over the window the user is actually looking at, plus the band mix as a bar
 * and three counts. It answers *what has this stretch of time been like*, which
 * is the question a history page opens on — never *what is this morning*, which
 * the dashboard tiles already answer and the deck's crosshair answers again.
 *
 * ── CORRECTION 2, IN FULL. The labels are the component, and they are why it
 * exists at all.
 *
 * The three figures are CLIENT MEANS over the RENDERED WINDOW, including today.
 * That makes this the only place on the page where a number is computed in the
 * browser, and the standing house rule — Fixed Decision 8, nothing recomputes a
 * server figure — survives it for one narrow, named reason: these means have no
 * server counterpart being re-derived. The three windows are sliced in memory
 * from a single fetch, so `Last 30 days` is a stretch of time only the client
 * knows about; there is no payload figure describing it that this could drift
 * from. Every other number on the page arrives computed. (`mean`'s own comment
 * in `./shared` carries the same carve-out from the other side.)
 *
 * What the labels PREVENT is a specific, embarrassing disagreement. The
 * resting-HR plot one register down prints, as its caption,
 * `baseline {win}d avg {v} bpm · excl. today` — `baseline.restingHrAvg`, a
 * TRAILING SERVER MEAN THAT EXCLUDES TODAY, which is also that plot's zero line.
 * At the 30d window the two are computed over almost the same nights, and they
 * WILL print different numbers: today is in one and not the other, and the
 * server's window is thirty stored readings rather than thirty rendered slots.
 * A user who spots `Resting HR 53` here and `avg 54 bpm` there reads it as a
 * bug, and they are right to — unless each figure says which one it is. So this
 * strip says `window avg` and the plot says `excl. today`, in every cell, on
 * every window. `window-strip.test.tsx` pins both strings in one test so the two
 * registers can never quietly converge again.
 *
 * The corollary is structural, not stylistic: this component takes NO `baseline`
 * prop. It cannot print `vs 30d`, cannot rank a window mean against
 * `baseline.recoveryScoreAvg`, `baseline.restingHrAvg` or `baseline.hrvAvg`, and
 * a future reader who wants it to would have to widen the signature first — at
 * which point they are making the decision rather than inheriting it.
 *
 * A cell that cannot say something honest says nothing: under
 * `MIN_BASELINE_DAYS` readings OF ITS OWN METRIC the figure is an em-dash and
 * the sub-line prints the count instead. The gate is per-metric because the
 * metrics go missing independently — a fortnight of strap-off HRV does not make
 * the resting-HR mean a lie.
 *
 * Colour is spent only in the band mix, where it is Whoop's own vocabulary via
 * `recoveryBandColor`; the three figures stay `--foreground` on purpose, because
 * a window average has no band.
 */

import type { RecoveryDayPoint } from "@/lib/dashboard";
import {
  MIN_BASELINE_DAYS,
  recoveryBandColor,
  round,
} from "@/app/(app)/dashboard/_components/recovery/shared";
import { bandCounts, mean } from "./shared";

/** The page's 10px label register, shared by the kicker and every cell foot. */
const LABEL = "text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--faint)]";

/**
 * The three cells, in the deck's own top-to-bottom order so the strip and the
 * plots below it read in the same sequence.
 *
 * `label` carries `· window avg` in every entry rather than the component
 * appending it, so the exact string a test asserts is the exact string in the
 * source — the disagreement in the header comment is a disagreement between two
 * literal captions, and grepping for one has to find it.
 */
const CELLS: {
  key: string;
  label: string;
  unit: string;
  pick: (d: RecoveryDayPoint) => number | null;
}[] = [
  { key: "score", label: "Score · window avg", unit: "%", pick: (d) => d.recoveryScore },
  { key: "rhr", label: "Resting HR · window avg", unit: "bpm", pick: (d) => d.restingHr },
  { key: "hrv", label: "HRV · window avg", unit: "ms", pick: (d) => d.hrv },
];

/** The band mix's segments, coloured by the tiles' single-sourced band palette. */
const BANDS = [
  { key: "green", color: recoveryBandColor("green") },
  { key: "yellow", color: recoveryBandColor("yellow") },
  { key: "red", color: recoveryBandColor("red") },
] as const;

/**
 * `days` is the RENDERED window — the same day objects the deck draws, handed
 * down rather than re-sliced here, so the strip and the plots can never describe
 * two different stretches of time. `caption` is the window's own prose
 * (`WINDOWS[n].caption`), which is what makes `window avg` mean something
 * specific rather than gesturing at "recently".
 */
export function WindowStrip({ caption, days }: { caption: string; days: RecoveryDayPoint[] }) {
  const counts = bandCounts(days);
  const scored = counts.green + counts.yellow + counts.red;

  return (
    <section className="border-y border-[var(--border)] py-4">
      <p className={`mb-3 ${LABEL}`}>{caption} · window orientation</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {CELLS.map((cell) => (
          <WindowCell
            key={cell.key}
            label={cell.label}
            unit={cell.unit}
            values={days.map(cell.pick)}
          />
        ))}
        <div>
          <div className="flex h-[24px] items-center">
            <div className="flex h-[8px] w-full overflow-hidden rounded-[2px] bg-[var(--surface-2)]">
              {scored > 0 &&
                BANDS.map((band) => (
                  <span
                    key={band.key}
                    style={{
                      width: `${(counts[band.key] / scored) * 100}%`,
                      backgroundColor: band.color,
                      opacity: 0.85,
                    }}
                  />
                ))}
            </div>
          </div>
          <div className="mt-1 flex items-baseline gap-1 font-mono text-[11px] tabular-nums">
            {scored === 0 ? (
              // A window with no scored morning gets prose, not an empty bar: a
              // bar at zero width reads as a rendering failure, and the counts
              // `0 · 0 · 0` claim three measurements that were never taken.
              <span className="text-[var(--faint)]">no scored mornings</span>
            ) : (
              BANDS.map((band, i) => (
                <span key={band.key} style={{ color: band.color }}>
                  {i > 0 && <span className="pr-1 text-[var(--faint)]">·</span>}
                  {counts[band.key]}
                </span>
              ))
            )}
          </div>
          <div className={`mt-1 ${LABEL}`}>Band mix</div>
        </div>
      </div>
    </section>
  );
}

/**
 * One window figure, with its own calibration gate.
 *
 * The threshold is `MIN_BASELINE_DAYS`, imported from the recovery tiles'
 * `shared.ts` rather than typed out — and BORROWING IT HERE IS A DECISION, not
 * an accident. That constant is the server's HRV/resting-HR baseline floor
 * (`min_baseline_days` in the API's `[recovery]` config); nothing about a client
 * mean over a rendered window obliges it to use the same number. It is taken
 * deliberately, as a general "enough nights to say something" threshold, so that
 * a user watching a fresh account fill up sees the strip and the tiles stop
 * hedging on the same morning rather than a week apart. If the API retunes its
 * floor, this moves with it — which is the behaviour worth having, and a
 * separate literal `14` here would silently not have it.
 *
 * The count is of PRESENT readings, never of slots: a window of thirty mornings
 * with eleven straps-off has eleven readings, not thirty, and the sub-line says
 * `11 of 14 nights` so the shortfall is legible rather than mysterious.
 */
function WindowCell({
  label,
  unit,
  values,
}: {
  label: string;
  unit: string;
  values: (number | null)[];
}) {
  const present = values.filter((v): v is number => v !== null);
  const enough = present.length >= MIN_BASELINE_DAYS;

  return (
    <div>
      <div className="flex h-[24px] items-baseline gap-1">
        <span className="text-[24px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[var(--foreground)]">
          {enough ? round(mean(values)) : "—"}
        </span>
        <span className="text-[10px] text-[var(--muted)]">{enough ? unit : "not yet"}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] tabular-nums text-[var(--faint)]">
        {enough ? (
          <>{present.length} nights</>
        ) : (
          <>
            {present.length} of {MIN_BASELINE_DAYS} nights
          </>
        )}
      </div>
      <div className={`mt-1 ${LABEL}`}>{label}</div>
    </div>
  );
}
