/**
 * Compact number formatter for the dense command-center surface.
 *
 * Small numbers stay exact with thousands separators (1840 → "1,840") so
 * step counts and rep totals read precisely; numbers ≥ 10,000 collapse to
 * a single-letter magnitude suffix (14000 → "14k", 2_400_000 → "2.4M") so
 * the KPI strip and card headlines stay one glance wide. Non-finite input
 * (NaN / Infinity) degrades to an em-dash so a brand-new/empty user never
 * sees "NaN".
 */
export function compact(n: number): string {
  if (!Number.isFinite(n)) return "—";

  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  // Below 10k: exact integer with thousands separators. Fractional inputs
  // round to a whole number here — the compact strip never shows decimals
  // in this range (callers wanting decimals use a dedicated formatter).
  if (abs < 10_000) {
    return sign + Math.round(abs).toLocaleString("en-US");
  }

  const units: { value: number; suffix: string }[] = [
    { value: 1_000_000_000, suffix: "B" },
    { value: 1_000_000, suffix: "M" },
    { value: 1_000, suffix: "k" },
  ];

  for (const { value, suffix } of units) {
    if (abs >= value) {
      const scaled = abs / value;
      // One decimal only when it carries signal (< 100 of the unit) and
      // isn't a clean integer, so we get "14k" and "2.4M" but not "14.0k".
      const rounded = Math.round(scaled * 10) / 10;
      const text =
        scaled < 100 && !Number.isInteger(rounded)
          ? rounded.toFixed(1)
          : String(Math.round(scaled));
      return sign + text + suffix;
    }
  }

  // Unreachable (abs ≥ 10k always matches the 1k unit), but keeps the
  // function total for the type checker.
  return sign + String(Math.round(abs));
}
