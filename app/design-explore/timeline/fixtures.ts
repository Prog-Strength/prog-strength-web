/**
 * Static fixtures for the timeline DX. A plausible multi-person *following*
 * feed (the live account follows no one yet) plus a weekly leaderboard and a
 * discovery set for the no-followers state. These are mockups — nothing here
 * touches lib/api or the live feed. Numbers are invented but realistic.
 *
 * Shared across all five variants on purpose: the *data* is constant so the
 * comparison isolates the visual treatment. Divergence lives in the variant
 * components, not here.
 */

export type SourceType = "run" | "workout" | "pr" | "best_effort";
export type ReactionType = "like" | "strong" | "fire" | "celebrate";

export type DxAuthor = {
  name: string;
  username: string;
  initials: string;
  is_self?: boolean;
};

export type DxPost = {
  id: string;
  author: DxAuthor;
  source_type: SourceType;
  occurred_at: string; // human relative label (mockup — no live clock)
  title: string;
  subtitle?: string;
  notes?: string;
  /** Labeled stat blocks, e.g. { label: "Distance", value: "12.4", unit: "mi" }. */
  stats: { label: string; value: string; unit?: string }[];
  reactions: Record<ReactionType, number>;
  mine: ReactionType[];
  comment_count: number;
  /** Normalized 0..1 GPS-ish polyline, present on runs that carry a route. */
  route?: { x: number; y: number }[];
  /** Muscle-group radar, present on workouts. label + 0..1 intensity. */
  radar?: { label: string; value: number }[];
  /** A sample top comment, for variants that preview the thread inline. */
  top_comment?: { author: string; body: string };
};

/** A stylized but plausible run track (normalized to a 0..1 box). */
const LAKEFRONT_ROUTE = [
  { x: 0.08, y: 0.62 },
  { x: 0.18, y: 0.4 },
  { x: 0.31, y: 0.46 },
  { x: 0.42, y: 0.24 },
  { x: 0.55, y: 0.3 },
  { x: 0.63, y: 0.14 },
  { x: 0.78, y: 0.22 },
  { x: 0.86, y: 0.44 },
  { x: 0.74, y: 0.58 },
  { x: 0.6, y: 0.52 },
  { x: 0.46, y: 0.68 },
  { x: 0.3, y: 0.6 },
  { x: 0.2, y: 0.78 },
  { x: 0.1, y: 0.7 },
];

const EASY_RUN_ROUTE = [
  { x: 0.1, y: 0.5 },
  { x: 0.24, y: 0.38 },
  { x: 0.4, y: 0.44 },
  { x: 0.52, y: 0.3 },
  { x: 0.66, y: 0.36 },
  { x: 0.8, y: 0.26 },
  { x: 0.9, y: 0.46 },
  { x: 0.72, y: 0.6 },
  { x: 0.5, y: 0.56 },
  { x: 0.3, y: 0.66 },
];

const SHOULDERS_RADAR = [
  { label: "Shoulders", value: 0.95 },
  { label: "Arms", value: 0.78 },
  { label: "Chest", value: 0.34 },
  { label: "Back", value: 0.42 },
  { label: "Legs", value: 0.12 },
  { label: "Core", value: 0.3 },
];

export const SELF: DxAuthor = { name: "You", username: "you", initials: "YO", is_self: true };

export const FEED: DxPost[] = [
  {
    id: "p1",
    author: { name: "Maya Okafor", username: "mayao", initials: "MO" },
    source_type: "run",
    occurred_at: "2h ago",
    title: "Sunday Long Run",
    subtitle: "Lakefront Loop · negative split, felt strong late",
    notes:
      "Held back for the first 8 then let it roll. Legs finally feel like base season is paying off.",
    stats: [
      { label: "Distance", value: "12.4", unit: "mi" },
      { label: "Time", value: "1:38:20" },
      { label: "Pace", value: "7:55", unit: "/mi" },
      { label: "Elev", value: "412", unit: "ft" },
    ],
    reactions: { like: 14, strong: 6, fire: 9, celebrate: 0 },
    mine: ["fire"],
    comment_count: 3,
    route: LAKEFRONT_ROUTE,
    top_comment: { author: "Devin Cross", body: "That last 5k pace is unreal 🔥" },
  },
  {
    id: "p2",
    author: SELF,
    source_type: "pr",
    occurred_at: "4h ago",
    title: "barbell-military-press PR",
    subtitle: "New 5-rep max",
    stats: [
      { label: "Weight", value: "155", unit: "lb" },
      { label: "Reps", value: "5" },
      { label: "Prev", value: "145", unit: "lb" },
    ],
    reactions: { like: 0, strong: 0, fire: 0, celebrate: 0 },
    mine: [],
    comment_count: 0,
  },
  {
    id: "p3",
    author: { name: "Devin Cross", username: "devinc", initials: "DC" },
    source_type: "workout",
    occurred_at: "6h ago",
    title: "Recovery Week Lift 2 — Shoulders & Arms",
    subtitle: "6 exercises · 26 sets",
    notes:
      "Deload week so kept everything at RPE 6. Pump was still ridiculous. Cruise control until the next block.",
    stats: [
      { label: "Exercises", value: "6" },
      { label: "Sets", value: "26" },
      { label: "Volume", value: "17,875", unit: "lb" },
    ],
    reactions: { like: 8, strong: 12, fire: 3, celebrate: 2 },
    mine: ["strong"],
    comment_count: 4,
    radar: SHOULDERS_RADAR,
    top_comment: {
      author: "Priya Nair",
      body: "Recovery weeks hit different when you actually take them lol",
    },
  },
  {
    id: "p4",
    author: SELF,
    source_type: "run",
    occurred_at: "Yesterday",
    title: "W7 D1 — Easy Run",
    subtitle: "Zone 2, kept it honest",
    stats: [
      { label: "Distance", value: "4.2", unit: "mi" },
      { label: "Time", value: "42:51" },
      { label: "Pace", value: "10:11", unit: "/mi" },
    ],
    reactions: { like: 5, strong: 2, fire: 1, celebrate: 0 },
    mine: [],
    comment_count: 1,
    route: EASY_RUN_ROUTE,
  },
  {
    id: "p5",
    author: { name: "Priya Nair", username: "priyan", initials: "PN" },
    source_type: "best_effort",
    occurred_at: "Yesterday",
    title: "New 5K Best Effort",
    subtitle: "First sub-22 of the build",
    stats: [
      { label: "Time", value: "21:46" },
      { label: "Pace", value: "7:00", unit: "/mi" },
      { label: "Prev best", value: "22:38" },
    ],
    reactions: { like: 6, strong: 4, fire: 11, celebrate: 7 },
    mine: ["celebrate"],
    comment_count: 2,
    top_comment: { author: "Maya Okafor", body: "LETS GO 🎉 sub-22 club" },
  },
];

export type ReactionMeta = { type: ReactionType; emoji: string; label: string };
export const REACTIONS: ReactionMeta[] = [
  { type: "like", emoji: "👍", label: "Like" },
  { type: "strong", emoji: "💪", label: "Strong" },
  { type: "fire", emoji: "🔥", label: "Fire" },
  { type: "celebrate", emoji: "🎉", label: "Celebrate" },
];

export const SOURCE_META: Record<SourceType, { emoji: string; glyph: string; label: string }> = {
  run: { emoji: "🏃", glyph: "run", label: "Run" },
  workout: { emoji: "🏋️", glyph: "lift", label: "Workout" },
  pr: { emoji: "🏆", glyph: "PR", label: "Personal Record" },
  best_effort: { emoji: "⚡", glyph: "best", label: "Best Effort" },
};

export function totalKudos(p: DxPost): number {
  return p.reactions.like + p.reactions.strong + p.reactions.fire + p.reactions.celebrate;
}

export function isMilestone(p: DxPost): boolean {
  return p.source_type === "pr" || p.source_type === "best_effort";
}

/** Weekly leaderboard fixture: ~8 followed athletes, the viewer mid-pack. */
export type LeaderRow = {
  rank: number;
  name: string;
  initials: string;
  steps: number;
  volume: number; // lb lifted this week
  is_self?: boolean;
};

export const LEADERBOARD: LeaderRow[] = [
  { rank: 1, name: "Priya Nair", initials: "PN", steps: 92140, volume: 61200 },
  { rank: 2, name: "Devin Cross", initials: "DC", steps: 88010, volume: 58450 },
  { rank: 3, name: "Maya Okafor", initials: "MO", steps: 81330, volume: 41980 },
  { rank: 4, name: "Theo Park", initials: "TP", steps: 77620, volume: 52300 },
  { rank: 5, name: "You", initials: "YO", steps: 71840, volume: 49675, is_self: true },
  { rank: 6, name: "Sam Idris", initials: "SI", steps: 66200, volume: 38900 },
  { rank: 7, name: "Lena Fox", initials: "LF", steps: 59410, volume: 44120 },
  { rank: 8, name: "Ravi Menon", initials: "RM", steps: 51870, volume: 33640 },
];

/** Suggested athletes for the no-followers discovery state. */
export type Suggestion = {
  name: string;
  username: string;
  initials: string;
  blurb: string;
  mutuals: number;
};

export const SUGGESTIONS: Suggestion[] = [
  {
    name: "Maya Okafor",
    username: "mayao",
    initials: "MO",
    blurb: "Marathon build · 50 mi/wk",
    mutuals: 3,
  },
  {
    name: "Devin Cross",
    username: "devinc",
    initials: "DC",
    blurb: "Powerbuilding · 5-day split",
    mutuals: 5,
  },
  {
    name: "Priya Nair",
    username: "priyan",
    initials: "PN",
    blurb: "5K–10K · sub-22 chaser",
    mutuals: 2,
  },
  {
    name: "Theo Park",
    username: "theop",
    initials: "TP",
    blurb: "Hybrid · run + barbell",
    mutuals: 4,
  },
];

/** Your-week summary for left-rail panels (Strava/soft idioms). */
export const MY_WEEK = {
  streak_weeks: 7,
  workouts: 4,
  runs: 3,
  miles: 28.6,
  volume_lb: 49675,
  // 7 days of activity load (0..1) for a mini bar chart, Mon→Sun.
  load: [0.4, 0.7, 0.2, 0.9, 0.5, 1.0, 0.3],
};
