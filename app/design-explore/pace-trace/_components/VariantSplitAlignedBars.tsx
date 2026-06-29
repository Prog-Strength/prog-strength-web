/**
 * IDIOM: split-aligned-bars (draws on Apple Fitness + Garmin Connect split
 * breakdowns).
 *
 * Abandons the continuous line entirely. Pace becomes per-split bars — one row
 * per split, column-aligned the way the splits ledger above already reads,
 * fastest and slowest marked, bar LENGTH encoding pace inverted (longer =
 * faster). The dropout is a single muted/hatched bar, not a gap in a line. A
 * calm, even row rhythm that rhymes with the ledger; medium type. The direct
 * counter-proposal to the line — the one that most reuses what the page knows.
 *
 * In-system: accent for the fastest bar, surface tones for the rest, --muted
 * type, Manrope. Diverges on FORM (bars, not a line) + ledger-aligned rows.
 */

import type { Fixture, PaceStripPoint } from "./fixtures";
import { fmtPace } from "./fixtures";

type Split = {
  label: string;
  pace: number | null; // null = dropout split
};

// Bucket points into per-1-unit splits, averaging the clean samples in each.
function toSplits(points: PaceStripPoint[]): Split[] {
  const maxX = Math.max(...points.map((p) => p.distanceUnit));
  const n = Math.max(1, Math.ceil(maxX));
  const splits: Split[] = [];
  for (let i = 0; i < n; i++) {
    const inBucket = points.filter(
      (p) => p.distanceUnit > i - 0.0001 && p.distanceUnit <= i + 1 + 0.0001,
    );
    const clean = inBucket.map((p) => p.paceSecPerUnit).filter((v): v is number => v != null);
    const isLast = i === n - 1;
    splits.push({
      label: isLast && maxX % 1 !== 0 ? `${maxX.toFixed(1)}` : `${i + 1}`,
      pace: clean.length ? Math.round(clean.reduce((a, b) => a + b, 0) / clean.length) : null,
    });
  }
  return splits;
}

export function VariantSplitAlignedBars({
  fixture,
  compact = false,
}: {
  fixture: Fixture;
  compact?: boolean;
}) {
  const splits = toSplits(fixture.points);
  const valid = splits.filter((s) => s.pace != null) as { label: string; pace: number }[];

  const card =
    "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4";

  if (valid.length < 1) {
    return (
      <div
        className={`${card} flex items-center justify-center`}
        style={{ minHeight: compact ? 110 : 200 }}
      >
        <p className="text-sm text-[var(--muted)]">No pace data</p>
      </div>
    );
  }

  const lo = Math.min(...valid.map((s) => s.pace)); // fastest
  const hi = Math.max(...valid.map((s) => s.pace)); // slowest
  const span = hi - lo || 1;
  // Inverted: faster (lo) → longer bar. Floor at 18% so the slowest bar is still a bar.
  const widthPct = (pace: number) => 18 + ((hi - pace) / span) * 82;

  return (
    <div className={card}>
      {!compact && (
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
            Pace by split
          </h3>
          <span className="text-[12px] text-[var(--muted)]">longer = faster · /{fixture.unit}</span>
        </div>
      )}
      <div className={compact ? "space-y-1" : "space-y-1.5"}>
        {splits.map((s, i) => {
          const isFastest = s.pace != null && s.pace === lo;
          const isSlowest = s.pace != null && s.pace === hi && hi !== lo;
          return (
            <div key={i} className="flex items-center gap-3">
              <span
                className={`w-6 shrink-0 text-right tabular-nums ${compact ? "text-[10px]" : "text-[13px]"} text-[var(--faint)]`}
              >
                {s.label}
              </span>
              <div
                className={`relative flex-1 ${compact ? "h-4" : "h-7"} overflow-hidden rounded-[6px] bg-[var(--surface-2)]`}
              >
                {s.pace == null ? (
                  // dropout split — hatched, no quantity
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--surface-3) 0 6px, transparent 6px 12px)",
                    }}
                  />
                ) : (
                  <div
                    className="absolute inset-y-0 left-0 rounded-[6px]"
                    style={{
                      width: `${widthPct(s.pace)}%`,
                      backgroundColor: isFastest
                        ? "var(--accent)"
                        : isSlowest
                          ? "var(--surface-3)"
                          : "var(--accent-soft)",
                      border: isSlowest ? "1px solid var(--border-strong)" : undefined,
                    }}
                  />
                )}
                {!compact && (
                  <span
                    className={`absolute inset-y-0 right-2 flex items-center tabular-nums text-[12px] ${isFastest ? "text-[var(--accent-fg)]" : "text-[var(--muted)]"}`}
                    style={isFastest ? { right: "auto", left: 10 } : undefined}
                  >
                    {s.pace == null ? "dropout" : fmtPace(s.pace)}
                  </span>
                )}
              </div>
              {!compact && (
                <span className="w-14 shrink-0 text-[11px] text-[var(--faint)]">
                  {isFastest ? "fastest" : isSlowest ? "slowest" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
