/**
 * Shared, static fixtures for the chat-and-app-shell Design Exploration.
 *
 * These are MOCK data only — nothing here touches the live agent, the SSE
 * stream, or `lib/api.ts`. The shapes mirror the real message model in
 * `app/(app)/chat/page.tsx` (ToolCall / Message) closely enough that each
 * variant renders the same realistic nutrition-logging conversation, the
 * same history list, and the same 12-item nav, so the only thing that
 * differs between variants is the *design*.
 *
 * Idioms are self-contained components; they import these fixtures but own
 * all of their own markup and styling. Duplication across variants is
 * intentional — divergence is the point of a DX, not shared abstraction.
 */

export type ToolState = "running" | "ok" | "error";
export type ToolCall = { name: string; state: ToolState };

/** One line of a macro table (the distinctive Prog Strength rich element). */
export type MacroRow = { item: string; cal: number; p: number; f: number; c: number };
export type MacroTable = { rows: MacroRow[]; total: MacroRow };

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  /** assistant only — raw model id, render via `modelLabel()` */
  model?: string;
  /** assistant only — tool calls with state */
  tools?: ToolCall[];
  /** user only — a flag that this turn carried an attached meal photo */
  image?: boolean;
  /** prose: user message text, or the assistant's opening line */
  text?: string;
  /** assistant only — a rendered macro table */
  table?: MacroTable;
  /** assistant only — the coach-tone closing line (may carry an emoji) */
  closing?: string;
};

/**
 * The representative conversation from the DX ticket — it exercises every
 * rich element: two model badges, three tool-call chips, a macro table with
 * a bold Total row, an attached meal photo, bold inline macro stats, and a
 * coach-tone closing line.
 */
export const CONVERSATION: ChatMessage[] = [
  {
    id: "m1",
    role: "user",
    text: "For lunch, I just had a turkey burger and bibigo white rice",
    image: true,
  },
  {
    id: "m2",
    role: "assistant",
    model: "claude-sonnet-4-6",
    tools: [
      { name: "log_consumption", state: "ok" },
      { name: "log_consumption", state: "ok" },
    ],
    text: "Logged! Here's your lunch:",
    table: {
      rows: [
        { item: "Columbus Turkey Burger", cal: 240, p: 30, f: 13, c: 2 },
        { item: "Bibigo Sticky White Rice", cal: 310, p: 6, f: 1, c: 71 },
      ],
      total: { item: "Total", cal: 550, p: 36, f: 14, c: 73 },
    },
    closing: "Solid macro split — good protein hit with the carbs to fuel the rest of your day. 💪",
  },
  {
    id: "m3",
    role: "user",
    text: "I also had some cherries with lunch too",
  },
  {
    id: "m4",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    tools: [{ name: "log_consumption", state: "ok" }],
    text: "Got it — added the cherries (20 cherries). Your lunch total is now **640 cal / 38g P / 14g F / 95g C**. Nice carb load for the day, bro.",
  },
];

/**
 * An error-state assistant turn, kept separate so variants can show the
 * failure treatment (a tool that errored) without disturbing the happy-path
 * conversation above.
 */
export const ERROR_TURN: ChatMessage = {
  id: "err",
  role: "assistant",
  model: "claude-haiku-4-5-20251001",
  tools: [{ name: "log_consumption", state: "error" }],
  text: "Hmm — I couldn't reach the nutrition log just now. Mind trying that again in a moment?",
};

/** Example prompts for the empty state. */
export const EMPTY_PROMPTS = [
  "What chest exercises are in the catalog?",
  "Log my lunch: turkey burger + white rice",
  "How's my bench progressing this month?",
  "What did I eat yesterday?",
];

/** Past sessions for the history pane/drawer. The first is the active one. */
export type Session = {
  id: string;
  title: string;
  messageCount: number;
  relativeTime: string;
  active?: boolean;
};

export const SESSIONS: Session[] = [
  { id: "s1", title: "Lunch Macros Logged", messageCount: 4, relativeTime: "now", active: true },
  {
    id: "s2",
    title: "Weight Check And Progress Tracking",
    messageCount: 6,
    relativeTime: "22h ago",
  },
  { id: "s3", title: "Quick Snack Calorie Logging", messageCount: 2, relativeTime: "yesterday" },
  {
    id: "s4",
    title: "Recovery Week Shoulders And Arms",
    messageCount: 9,
    relativeTime: "2 days ago",
  },
  { id: "s5", title: "Chest Exercise Catalog Lookup", messageCount: 5, relativeTime: "4 days ago" },
  { id: "s6", title: "Deload Plan And Sleep Notes", messageCount: 7, relativeTime: "last week" },
];

/** The 12 nav destinations — kept verbatim from the real sidebar. */
export type NavKey =
  | "chat"
  | "timeline"
  | "search"
  | "requests"
  | "activities"
  | "exercises"
  | "calendar"
  | "nutrition"
  | "bodyweight"
  | "progress"
  | "records"
  | "settings";

export type NavItem = { key: NavKey; label: string };

export const NAV: NavItem[] = [
  { key: "chat", label: "Chat" },
  { key: "timeline", label: "Timeline" },
  { key: "search", label: "Search" },
  { key: "requests", label: "Requests" },
  { key: "activities", label: "Activities" },
  { key: "exercises", label: "Exercises" },
  { key: "calendar", label: "Calendar" },
  { key: "nutrition", label: "Nutrition" },
  { key: "bodyweight", label: "Bodyweight" },
  { key: "progress", label: "Progress" },
  { key: "records", label: "Personal Records" },
  { key: "settings", label: "Settings" },
];

export const USER = { name: "Jimmy Wallace", initials: "JW" };

/** `claude-sonnet-4-6` → `Sonnet 4.6`, `claude-haiku-4-5-…` → `Haiku 4.5`. */
export function modelLabel(model: string): string {
  const match = model.match(/^claude-([a-z]+)-(\d+)-(\d+)/);
  if (!match) return model;
  const [, family, major, minor] = match;
  return `${family[0].toUpperCase() + family.slice(1)} ${major}.${minor}`;
}

/** `log_consumption` → `Log Consumption`. */
export function toolLabel(name: string): string {
  return name
    .split("_")
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
}
