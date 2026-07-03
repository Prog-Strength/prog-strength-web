/** seconds (already per active unit) → "m:ss"; em-dash for non-finite/negative. */
export function formatPaceClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Null-tolerant wrapper: "—" for null, else formatPaceClock. */
export function formatPaceClockOrDash(sec: number | null): string {
  return sec == null ? "—" : formatPaceClock(sec);
}

/** Signed pace delta in sec/unit: "+m:ss" slower, "−m:ss" faster. */
export function formatPaceDelta(deltaSec: number): string {
  const sign = deltaSec < 0 ? "−" : "+";
  const abs = Math.abs(Math.round(deltaSec));
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, "0")}`;
}
