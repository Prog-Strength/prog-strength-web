"use client";

/**
 * IDIOM: confidence-ledger — draws on Runalyze's running-prognosis transparency.
 *
 * Treats the number as a CLAIM that must show its work. A dense, analytical,
 * report-like layout that foregrounds how the estimate was derived: confidence,
 * the n_points / n_distances basis, the basis/estimator_version, and the
 * attempts table promoted to PRIMARY evidence with its sources broken out and
 * weighted (race-like efforts count more than long-run windows).
 *
 * DIVERGES ON (in-system):
 *  · type scale — uniform and fine; hierarchy comes from alignment and the
 *    incidental-mono numerals (Geist_Mono, kept by the system), not from size.
 *  · color logic — restrained, COLOUR-AS-STATE only: confidence level, source
 *    type, and gap sign. Everything else is neutral ink.
 *  · spacing rhythm — dense, gridded, maximally informative — a report, not a card.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";
import {
  confidenceLevel,
  fmtMagnitude,
  fmtPaceMi,
  fmtTime,
  humanizeSource,
  titleCase,
} from "../_shared/format";

/** How much each source contributes to the fit — race efforts are trusted
 *  more than long-run windows. Mirrors the ticket's weighting note. */
const SOURCE_WEIGHT: Record<string, number> = {
  race_like: 1.0,
  tempo: 0.8,
  long_run: 0.6,
  long_run_window: 0.6,
};
function weightOf(source: string): number {
  return SOURCE_WEIGHT[source] ?? 0.5;
}

export function ConfidenceLedger({ detail }: { detail: RunningMaxEffortDetail }) {
  const est = detail.estimate;
  const conf = confidenceLevel(detail.stats.confidence);
  const gap = detail.stats.gap_seconds;
  const half = est ? Math.round((est.upper_seconds - est.lower_seconds) / 2) : null;

  const confTone =
    conf.level >= 3 ? "var(--success)" : conf.level === 2 ? "var(--warning)" : "var(--danger)";

  return (
    <div className="px-5 py-5 font-mono text-[13px] text-[var(--foreground)]">
      {/* header line */}
      <div className="flex items-baseline justify-between border-b border-[var(--border-strong)] pb-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
          Max-effort estimate · derivation
        </span>
        <span className="text-[11px] text-[var(--faint)]">
          {detail.distance_label} · est {detail.estimator_version}
        </span>
      </div>

      {/* the claim */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1 border-b border-[var(--border)] py-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">estimate</p>
          <p className="text-3xl tracking-[-0.02em] text-[var(--accent)]">
            {est ? fmtTime(est.seconds) : "—:—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">
            95% interval
          </p>
          <p className="text-base">
            {est ? `${fmtTime(est.lower_seconds)} … ${fmtTime(est.upper_seconds)}` : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">± margin</p>
          <p className="text-base">{half != null ? fmtMagnitude(half) : "—"}</p>
        </div>
      </div>

      {/* derivation grid */}
      <dl className="grid grid-cols-2 gap-x-8 gap-y-0 py-2 sm:grid-cols-3">
        <LedgerRow k="confidence">
          <span className="inline-flex items-center gap-1.5" style={{ color: confTone }}>
            {conf.label}
            <span className="inline-flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <span
                  key={i}
                  className="h-2.5 w-1 rounded-[1px]"
                  style={{ backgroundColor: i <= conf.level ? confTone : "var(--surface-3)" }}
                />
              ))}
            </span>
          </span>
        </LedgerRow>
        <LedgerRow k="samples (n)">{est ? est.n_points : "0"}</LedgerRow>
        <LedgerRow k="distances">{est ? est.n_distances : "0"}</LedgerRow>
        <LedgerRow k="basis">{est ? titleCase(est.basis) : "Insufficient data"}</LedgerRow>
        <LedgerRow k="current best">
          {detail.actual_best ? fmtTime(detail.actual_best.seconds) : "— (never run)"}
        </LedgerRow>
        <LedgerRow k="gap vs best">
          {gap != null ? (
            <span style={{ color: gap < 0 ? "var(--success)" : "var(--accent)" }}>
              {gap < 0 ? "−" : "+"}
              {fmtMagnitude(gap)} {gap < 0 ? "(proof faster)" : "(proj. leads)"}
            </span>
          ) : (
            "—"
          )}
        </LedgerRow>
      </dl>

      {/* evidence table — primary, weighted */}
      <p className="mt-2 mb-1 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
        Evidence — efforts feeding the fit
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-y border-[var(--border)] text-left text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">
            <th className="py-1.5 pr-2 font-normal">date</th>
            <th className="py-1.5 pr-2 text-right font-normal">time</th>
            <th className="py-1.5 pr-2 text-right font-normal">pace</th>
            <th className="py-1.5 pr-2 font-normal">source</th>
            <th className="py-1.5 text-right font-normal">weight</th>
          </tr>
        </thead>
        <tbody>
          {detail.attempts.length === 0 && (
            <tr>
              <td colSpan={5} className="py-3 text-center text-[var(--faint)]">
                no direct efforts — fit projected from neighbouring distances
              </td>
            </tr>
          )}
          {detail.attempts.map((a) => {
            const w = weightOf(a.source);
            const isRace = a.source === "race_like";
            return (
              <tr key={a.activity_id} className="border-b border-[var(--border)] last:border-0">
                <td className="py-1.5 pr-2 text-[var(--muted)]">
                  {new Date(a.achieved_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "2-digit",
                  })}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {fmtTime(a.duration_seconds)}
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums text-[var(--muted)]">
                  {fmtPaceMi(a.pace_sec_per_km)}
                </td>
                <td className="py-1.5 pr-2">
                  <span style={{ color: isRace ? "var(--accent-2)" : "var(--muted)" }}>
                    {humanizeSource(a.source)}
                  </span>
                </td>
                <td className="py-1.5">
                  <div className="flex items-center justify-end gap-2">
                    <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[var(--surface-3)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${w * 100}%`,
                          backgroundColor: isRace ? "var(--accent-2)" : "var(--muted)",
                        }}
                      />
                    </span>
                    <span className="w-7 text-right tabular-nums text-[var(--faint)]">
                      {w.toFixed(1)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--faint)]">
        Race-like efforts are weighted highest; long-run windows contribute less because pacing is
        sub-maximal.{" "}
        {est
          ? `Trust this number once the sample (n=${est.n_points}) and distance spread support it.`
          : ""}
      </p>
    </div>
  );
}

function LedgerRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] py-1.5">
      <dt className="text-[10px] uppercase tracking-[0.1em] text-[var(--faint)]">{k}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
