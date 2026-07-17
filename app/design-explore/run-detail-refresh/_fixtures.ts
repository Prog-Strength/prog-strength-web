/**
 * Static fixtures for the run-detail-refresh Design Exploration.
 *
 * DISPOSABLE. These mirror the shape of the real `/running/[id]` detail GET
 * (see dx/run-detail-refresh.md) but are hand-authored so the comparison route
 * renders with zero backend. Numbers match the ticket's representative trail
 * run: "W11 D2 - Trail Run", Wed Jul 15 2026 · 6:46 PM, 1:10:48, 7.0 mi.
 *
 * `notes` is a UI-only mock for this DX (persistence lands in a later SOW).
 */

export type Split = {
  index: number;
  paceSecPerMi: number;
  hr: number | null;
  elevDeltaM: number | null;
  fastest?: boolean;
  slowest?: boolean;
};

export type TracePoint = {
  mi: number;
  paceSecPerMi: number | null; // null == GPS dropout (never bridged)
  hr: number | null;
  elevM: number | null;
};

export type Zone = {
  zone: number;
  name: string;
  minBpm: number;
  maxBpm: number;
  pct: number; // 0..1
};

export type RunSession = {
  id: string;
  name: string;
  startLabel: string; // "Wed Jul 15 2026 · 6:46 PM"
  kicker: string; // "Wed · Jul 15 · Evening"
  environment: "outdoor" | "indoor";
  distanceMi: number;
  durationSec: number;
  avgPaceSecPerMi: number;
  bestPaceSecPerMi: number;
  avgHr: number | null;
  maxHr: number | null;
  calories: number | null;
  elevGainM: number | null;
  hasRoute: boolean;
  hasElevation: boolean;
  planName: string | null;
  prescription: string | null;
  notesFilled: string;
  splits: Split[];
  zones: Zone[] | null;
  trace: TracePoint[];
  paceFastestSecPerMi: number; // strip summary
  paceSlowestSecPerMi: number;
  dropoutCount: number;
};

// --- helpers --------------------------------------------------------------

export function fmtClock(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.round(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function fmtElevDelta(m: number | null): string {
  if (m == null) return "—";
  const r = Math.round(m);
  if (r === 0) return "0 m";
  return `${r < 0 ? "−" : "+"}${Math.abs(r)} m`;
}

// --- splits (7 miles, Mi1 fastest, Mi6 slowest) ---------------------------

const SPLITS: Split[] = [
  { index: 0, paceSecPerMi: 563, hr: 152, elevDeltaM: -18, fastest: true }, // 9:23
  { index: 1, paceSecPerMi: 591, hr: 161, elevDeltaM: 8 }, // 9:51
  { index: 2, paceSecPerMi: 614, hr: 168, elevDeltaM: 34 }, // 10:14
  { index: 3, paceSecPerMi: 584, hr: 170, elevDeltaM: -12 }, // 9:44
  { index: 4, paceSecPerMi: 639, hr: 172, elevDeltaM: 41 }, // 10:39
  { index: 5, paceSecPerMi: 665, hr: 166, elevDeltaM: 52, slowest: true }, // 11:05
  { index: 6, paceSecPerMi: 602, hr: 171, elevDeltaM: -60 }, // 10:02
];

const ZONES: Zone[] = [
  { zone: 1, name: "Recovery", minBpm: 0, maxBpm: 130, pct: 0.01 },
  { zone: 2, name: "Endurance", minBpm: 131, maxBpm: 149, pct: 0.02 },
  { zone: 3, name: "Tempo", minBpm: 150, maxBpm: 163, pct: 0.02 },
  { zone: 4, name: "Threshold", minBpm: 164, maxBpm: 177, pct: 0.62 },
  { zone: 5, name: "VO2 max", minBpm: 178, maxBpm: 200, pct: 0.33 },
];

// --- continuous trace over 7 mi ------------------------------------------
// Deterministic synthesis (no RNG): a rolling pace with two GPS dropout
// windows, HR that climbs on the mid-run ascent, and a trail elevation
// profile that nets +243 m of gain across descents and climbs.

function buildTrace(withElev: boolean, withHr: boolean): TracePoint[] {
  const N = 84;
  const pts: TracePoint[] = [];
  // dropout windows (in mi): a short gap ~mi 3.2 and a longer one ~mi 5.6
  const inDropout = (mi: number) => (mi > 3.05 && mi < 3.35) || (mi > 5.45 && mi < 5.95);
  for (let i = 0; i <= N; i++) {
    const mi = (i / N) * 7.0;
    // pace: base 590s, faster early, slower on the mile-5/6 climb, surge home
    const climb = Math.max(0, Math.sin(((mi - 2.4) / 3.6) * Math.PI)); // peaks ~mi 4.2
    const wobble = Math.sin(mi * 5.1) * 14 + Math.sin(mi * 1.7) * 22;
    let pace = 560 + climb * 120 + wobble - (mi > 6.2 ? 60 : 0);
    pace = Math.max(458, Math.min(656, pace)); // 7:38 .. 10:56
    // hr: rises through the run, peaks on the climb
    const hr = withHr ? Math.round(150 + climb * 26 + mi * 2.4 + Math.sin(mi * 3.3) * 4) : null;
    // elevation: rolling profile, net +243 m
    const elev = withElev
      ? Math.round(
          1710 +
            Math.sin(mi * 0.9) * 34 +
            Math.sin(mi * 2.1 + 1) * 18 +
            (mi > 4 && mi < 6 ? (mi - 4) * 26 : 0) -
            (mi > 6 ? (mi - 6) * 30 : 0),
        )
      : null;
    pts.push({
      mi: Number(mi.toFixed(3)),
      paceSecPerMi: inDropout(mi) ? null : Math.round(pace),
      hr,
      elevM: elev,
    });
  }
  return pts;
}

const NOTES_FILLED =
  "Legs heavy on the climb after mile 4; backed off on purpose. Cool evening in Frisco — felt better once I stopped chasing pace.";

// --- scenarios ------------------------------------------------------------

const BASE: RunSession = {
  id: "dx-trail",
  name: "W11 D2 - Trail Run",
  startLabel: "Wed Jul 15 2026 · 6:46 PM",
  kicker: "Wed · Jul 15 · Evening",
  environment: "outdoor",
  distanceMi: 7.0,
  durationSec: 4248, // 1:10:48
  avgPaceSecPerMi: 606, // 10:06
  bestPaceSecPerMi: 539, // 8:59
  avgHr: 167,
  maxHr: 184,
  calories: 992,
  elevGainM: 243,
  hasRoute: true,
  hasElevation: true,
  planName: "W11 D2 · Endurance",
  prescription: "Easy trail hour · keep HR under threshold",
  notesFilled: NOTES_FILLED,
  splits: SPLITS,
  zones: ZONES,
  trace: buildTrace(true, true),
  paceFastestSecPerMi: 458, // 7:38
  paceSlowestSecPerMi: 656, // 10:56
  dropoutCount: 2,
};

export type ScenarioKey = "trail" | "noElev" | "indoor" | "noHr";

export const SCENARIOS: { key: ScenarioKey; label: string; blurb: string }[] = [
  { key: "trail", label: "Trail (happy path)", blurb: "outdoor · route · elevation · HR" },
  { key: "noElev", label: "No elevation", blurb: "route present, elev trace omitted" },
  { key: "indoor", label: "Indoor / no route", blurb: "treadmill · no map slot" },
  { key: "noHr", label: "Missing HR", blurb: "zones + HR trace omitted honestly" },
];

export function sessionFor(scenario: ScenarioKey): RunSession {
  switch (scenario) {
    case "noElev":
      return {
        ...BASE,
        hasElevation: false,
        elevGainM: null,
        splits: SPLITS.map((s) => ({ ...s, elevDeltaM: null })),
        trace: buildTrace(false, true),
      };
    case "indoor":
      return {
        ...BASE,
        name: "W11 D2 - Treadmill",
        environment: "indoor",
        hasRoute: false,
        hasElevation: false,
        elevGainM: null,
        splits: SPLITS.map((s) => ({ ...s, elevDeltaM: null })),
        trace: buildTrace(false, true),
      };
    case "noHr":
      return {
        ...BASE,
        avgHr: null,
        maxHr: null,
        zones: null,
        splits: SPLITS.map((s) => ({ ...s, hr: null })),
        trace: buildTrace(true, false),
      };
    case "trail":
    default:
      return BASE;
  }
}
