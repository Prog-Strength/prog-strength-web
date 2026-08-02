/**
 * Throwaway neighbor mock tiles for the pair-in-grid composition mock.
 *
 * Static Steps and Blood Pressure cards that echo the real dashboard grammar
 * (BigNum-ish headline, a small chart row, a MetaRow) closely enough to judge a
 * recovery variant sitting beside them on one grid. NOT the production cards —
 * those need live section data; these are frozen fixtures for the DX only.
 */

import { MockCard } from "./_shell";

export function StepsNeighbor() {
  const bars = [62, 88, 40, 100, 74, 55, 30]; // % heights, last = today
  return (
    <MockCard title="Steps">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          6,204
        </span>
        <span className="text-xs font-medium text-[var(--muted)]">today</span>
      </div>
      <div className="relative h-12 w-full">
        <div className="absolute inset-x-0 bottom-[70%] z-20 border-t border-dashed border-[var(--success)]" />
        <div className="absolute inset-0 z-10 flex items-end gap-[3px]">
          {bars.map((h, i) => (
            <div key={i} className="flex h-full flex-1 items-end">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${h}%`,
                  backgroundColor:
                    i === bars.length - 1
                      ? "var(--accent)"
                      : h >= 70
                        ? "var(--success)"
                        : "var(--muted)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">avg</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">8,410</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">goal</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">10,000</span>
        </span>
      </div>
    </MockCard>
  );
}

export function BloodPressureNeighbor() {
  return (
    <MockCard title="Blood Pressure">
      <div className="flex items-baseline gap-1">
        <span className="font-mono text-2xl font-semibold tracking-tight tabular-nums text-[var(--foreground)]">
          118/76
        </span>
      </div>
      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className="h-7 w-full"
        aria-hidden="true"
      >
        <polyline
          points="0,10 16,8 33,12 50,7 66,11 83,9 100,10"
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points="0,20 16,19 33,21 50,18 66,20 83,19 100,20"
          fill="none"
          stroke="var(--muted)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">category</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">Normal</span>
        </span>
        <span className="text-[var(--faint)]">·</span>
        <span className="flex items-center gap-1">
          <span className="text-[var(--muted)]">30d avg</span>
          <span className="font-mono tabular-nums text-[var(--foreground)]">120/78</span>
        </span>
      </div>
    </MockCard>
  );
}
