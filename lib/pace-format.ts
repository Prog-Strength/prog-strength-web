/** seconds (already per active unit) → "m:ss"; em-dash for non-finite/negative. */
export function formatPaceClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  const total = Math.round(sec);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
