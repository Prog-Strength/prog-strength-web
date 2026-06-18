/**
 * Static fixtures for the running-max-effort-estimate Design Exploration.
 *
 * These are NOT live data — the DX comparison route never wires to the
 * estimate service (see dx/running-max-effort-estimate.md). Each fixture is
 * a full `RunningMaxEffortDetail` shaped exactly like the API response so
 * every variant renders realistically and degrades through the edge states
 * the ticket calls out.
 *
 * The `representative` fixture is the screenshot case the ticket pins: a 10K
 * estimate of 53:42 that is SLOWER than the runner's actual best (41:35),
 * high confidence, on a slowing trend — the tension the whole surface exists
 * to tell. The others exercise the states where lazy designs fall apart.
 */

import type { RunningMaxEffortDetail } from "@/lib/api";

export type FixtureKey =
  | "representative"
  | "faster-trend"
  | "wide-band"
  | "insufficient"
  | "never-covered";

export type FixtureOption = {
  key: FixtureKey;
  label: string;
  /** One line on what state this exercises — shown in the switcher. */
  note: string;
  detail: RunningMaxEffortDetail;
};

/** The pinned screenshot case: estimate slower than proof, high confidence,
 *  slowing trend, mixed sources. This is what the variants are tuned to. */
const representative: RunningMaxEffortDetail = {
  estimator_version: "v3.2.0",
  distance_key: "10k",
  distance_label: "10K",
  distance_meters: 10000,
  estimate: {
    seconds: 3222, // 53:42
    lower_seconds: 3190, // 53:10
    upper_seconds: 3258, // 54:18
    basis: "multi_distance_fit",
    confidence: "high",
    n_points: 75,
    n_distances: 4,
  },
  actual_best: {
    seconds: 2495, // 41:35
    activity_id: "act-10k-0411",
    achieved_at: "2026-04-11T08:12:00Z",
  },
  estimate_history: [
    { as_of: "2026-04-11", seconds: 2700, lower_seconds: 2580, upper_seconds: 2880 },
    { as_of: "2026-04-20", seconds: 2820, lower_seconds: 2710, upper_seconds: 2960 },
    { as_of: "2026-04-28", seconds: 2940, lower_seconds: 2850, upper_seconds: 3050 },
    { as_of: "2026-05-05", seconds: 3050, lower_seconds: 2980, upper_seconds: 3140 },
    { as_of: "2026-05-12", seconds: 3140, lower_seconds: 3090, upper_seconds: 3210 },
    { as_of: "2026-05-18", seconds: 3195, lower_seconds: 3160, upper_seconds: 3240 },
    { as_of: "2026-05-22", seconds: 3222, lower_seconds: 3190, upper_seconds: 3258 },
  ],
  attempts: [
    {
      activity_id: "act-10k-0411",
      achieved_at: "2026-04-11T08:12:00Z",
      duration_seconds: 2495, // 41:35
      pace_sec_per_km: 249,
      source: "long_run",
    },
    {
      activity_id: "act-10k-0508",
      achieved_at: "2026-05-08T07:40:00Z",
      duration_seconds: 3183, // 53:03
      pace_sec_per_km: 318,
      source: "long_run",
    },
    {
      activity_id: "act-10k-0522",
      achieved_at: "2026-05-22T17:05:00Z",
      duration_seconds: 3401, // 56:41
      pace_sec_per_km: 340,
      source: "race_like",
    },
  ],
  stats: {
    estimated_max_effort_seconds: 3222,
    current_best_seconds: 2495,
    gap_seconds: -727, // best − estimate; negative = proof is faster
    confidence: "high",
    data_summary: "75 efforts across 4 distances",
  },
};

/** The earned, improving case: a 5K estimate falling over the window, medium
 *  confidence, estimate slightly ahead of the (older) proof. */
const fasterTrend: RunningMaxEffortDetail = {
  estimator_version: "v3.2.0",
  distance_key: "5k",
  distance_label: "5K",
  distance_meters: 5000,
  estimate: {
    seconds: 1305, // 21:45
    lower_seconds: 1290, // 21:30
    upper_seconds: 1322, // 22:02
    basis: "multi_distance_fit",
    confidence: "medium",
    n_points: 28,
    n_distances: 3,
  },
  actual_best: {
    seconds: 1338, // 22:18
    activity_id: "act-5k-0302",
    achieved_at: "2026-03-02T09:00:00Z",
  },
  estimate_history: [
    { as_of: "2026-04-01", seconds: 1410, lower_seconds: 1360, upper_seconds: 1470 },
    { as_of: "2026-04-12", seconds: 1385, lower_seconds: 1345, upper_seconds: 1430 },
    { as_of: "2026-04-24", seconds: 1360, lower_seconds: 1328, upper_seconds: 1398 },
    { as_of: "2026-05-06", seconds: 1335, lower_seconds: 1310, upper_seconds: 1362 },
    { as_of: "2026-05-16", seconds: 1318, lower_seconds: 1298, upper_seconds: 1340 },
    { as_of: "2026-05-22", seconds: 1305, lower_seconds: 1290, upper_seconds: 1322 },
  ],
  attempts: [
    {
      activity_id: "act-5k-0520",
      achieved_at: "2026-05-20T18:10:00Z",
      duration_seconds: 1322, // 22:02
      pace_sec_per_km: 264,
      source: "race_like",
    },
    {
      activity_id: "act-5k-0506",
      achieved_at: "2026-05-06T06:55:00Z",
      duration_seconds: 1351, // 22:31
      pace_sec_per_km: 270,
      source: "long_run",
    },
    {
      activity_id: "act-5k-0410",
      achieved_at: "2026-04-10T07:20:00Z",
      duration_seconds: 1402, // 23:22
      pace_sec_per_km: 280,
      source: "long_run",
    },
  ],
  stats: {
    estimated_max_effort_seconds: 1305,
    current_best_seconds: 1338,
    gap_seconds: 33, // best − estimate; positive = projection is ahead of proof
    confidence: "medium",
    data_summary: "28 efforts across 3 distances",
  },
};

/** Low confidence, few samples, one distance — the band must read WIDE so the
 *  headline never feels like false precision. Half marathon. */
const wideBand: RunningMaxEffortDetail = {
  estimator_version: "v3.2.0",
  distance_key: "half_marathon",
  distance_label: "Half Marathon",
  distance_meters: 21097,
  estimate: {
    seconds: 6240, // 1:44:00
    lower_seconds: 5820, // 1:37:00
    upper_seconds: 6720, // 1:52:00
    basis: "single_distance_fit",
    confidence: "low",
    n_points: 6,
    n_distances: 1,
  },
  actual_best: {
    seconds: 6510, // 1:48:30
    activity_id: "act-hm-0215",
    achieved_at: "2026-02-15T08:00:00Z",
  },
  estimate_history: [
    { as_of: "2026-04-18", seconds: 6180, lower_seconds: 5700, upper_seconds: 6660 },
    { as_of: "2026-05-20", seconds: 6240, lower_seconds: 5820, upper_seconds: 6720 },
  ],
  attempts: [
    {
      activity_id: "act-hm-0520",
      achieved_at: "2026-05-20T08:30:00Z",
      duration_seconds: 6510, // 1:48:30
      pace_sec_per_km: 308,
      source: "race_like",
    },
    {
      activity_id: "act-hm-0418",
      achieved_at: "2026-04-18T08:00:00Z",
      duration_seconds: 6720, // 1:52:00
      pace_sec_per_km: 318,
      source: "long_run",
    },
  ],
  stats: {
    estimated_max_effort_seconds: 6240,
    current_best_seconds: 6510,
    gap_seconds: 270,
    confidence: "low",
    data_summary: "6 efforts at 1 distance",
  },
};

/** No estimate at all — the page must degrade to an inviting hint, never a row
 *  of blanks or 0:00. 2 Mile, never logged. */
const insufficient: RunningMaxEffortDetail = {
  estimator_version: "v3.2.0",
  distance_key: "2mi",
  distance_label: "2 Mile",
  distance_meters: 3218,
  estimate: null,
  actual_best: null,
  estimate_history: [],
  attempts: [],
  stats: {
    estimated_max_effort_seconds: null,
    current_best_seconds: null,
    gap_seconds: null,
    confidence: "",
    data_summary: "Not enough efforts to estimate yet",
  },
};

/** Estimate exists (fit from neighbouring distances) but the runner has never
 *  actually covered this one — the compare-to-reality slot has nothing. 1 Mile. */
const neverCovered: RunningMaxEffortDetail = {
  estimator_version: "v3.2.0",
  distance_key: "1mi",
  distance_label: "1 Mile",
  distance_meters: 1609,
  estimate: {
    seconds: 372, // 6:12
    lower_seconds: 366, // 6:06
    upper_seconds: 380, // 6:20
    basis: "multi_distance_fit",
    confidence: "high",
    n_points: 40,
    n_distances: 4,
  },
  actual_best: null,
  estimate_history: [
    { as_of: "2026-04-10", seconds: 366, lower_seconds: 360, upper_seconds: 374 },
    { as_of: "2026-04-24", seconds: 369, lower_seconds: 363, upper_seconds: 376 },
    { as_of: "2026-05-08", seconds: 371, lower_seconds: 365, upper_seconds: 378 },
    { as_of: "2026-05-22", seconds: 372, lower_seconds: 366, upper_seconds: 380 },
  ],
  attempts: [],
  stats: {
    estimated_max_effort_seconds: 372,
    current_best_seconds: null,
    gap_seconds: null,
    confidence: "high",
    data_summary: "40 efforts across 4 distances",
  },
};

export const FIXTURES: FixtureOption[] = [
  {
    key: "representative",
    label: "Representative (10K)",
    note: "Estimate slower than proof · high confidence · slowing trend — the pinned case.",
    detail: representative,
  },
  {
    key: "faster-trend",
    label: "Improving (5K)",
    note: "Estimate falling over the window · medium confidence · earned, not concerning.",
    detail: fasterTrend,
  },
  {
    key: "wide-band",
    label: "Wide band (Half)",
    note: "Low confidence · 6 efforts · the range must read honestly wide.",
    detail: wideBand,
  },
  {
    key: "insufficient",
    label: "No data (2 Mile)",
    note: "estimate === null — degrades to an inviting hint, never 0:00.",
    detail: insufficient,
  },
  {
    key: "never-covered",
    label: "Never run (1 Mile)",
    note: "actual_best === null — estimate stands without a real comparison.",
    detail: neverCovered,
  },
];

export const REPRESENTATIVE = representative;
