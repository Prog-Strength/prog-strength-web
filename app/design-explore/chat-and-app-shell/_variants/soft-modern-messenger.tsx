/*
 * VARIANT — soft-modern-messenger
 * Idiom: best-in-class polished modern messenger on approachable mid-contrast
 *   slate dark with ONE friendly violet accent; refined rounded bubbles, soft
 *   depth, comfortable rhythm — modern chat done genuinely well, not a clone.
 *
 * Three axes:
 *   - Type scale:    Nunito rounded sans; comfortable size steps
 *                    (11 → 13 → 14 → 15 → 18 → 22) with friendly 600/700/800 weights.
 *   - Color logic:   softer slate neutrals (#15171c base, #1e2128 panels, #272b33
 *                    raised) + ONE warm violet accent (#8b7cf6) reserved for the
 *                    user's bubbles + send + active states; everything else neutral.
 *   - Spacing rhythm: generous, rounded — 4px grid breathing to 6/8 around bubbles,
 *                    rounded-2xl/3xl corners, soft shadows for gentle depth.
 */
import { BrandMark } from "@/components/brand-mark";
import {
  CONVERSATION,
  EMPTY_PROMPTS,
  ERROR_TURN,
  NAV,
  SESSIONS,
  USER,
  modelLabel,
  toolLabel,
  type ChatMessage,
  type MacroTable,
  type ToolCall,
} from "./fixtures";
import { NavIcon } from "./nav-icons";

/* ── palette ──────────────────────────────────────────────────────────── */
const BASE = "#15171c"; // app background
const PANEL = "#1e2128"; // rails / cards
const RAISED = "#272b33"; // assistant bubbles / chips
const RAISED2 = "#2e333c"; // hover / inputs
const BORDER = "rgba(255,255,255,0.07)";
const BORDER2 = "rgba(255,255,255,0.10)";
const TEXT = "#eef0f4";
const MUTED = "#9aa1ad";
const FAINT = "#6b7280";
const ACCENT = "#8b7cf6"; // friendly violet
const ACCENT_DK = "#7765ec";
const ACCENT_SOFT = "rgba(139,124,246,0.14)";
const ACCENT_LINE = "rgba(139,124,246,0.30)";

/* macro chip tints (P / F / C) — quiet, friendly */
const MACRO = {
  p: { fg: "#34d399", bg: "rgba(52,211,153,0.13)" },
  f: { fg: "#fbbf24", bg: "rgba(251,191,36,0.13)" },
  c: { fg: "#60a5fa", bg: "rgba(96,165,250,0.13)" },
};

/* ── tiny helpers ─────────────────────────────────────────────────────── */

/** split a string on **bold** spans and render the wrapped runs bold. */
function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: TEXT, fontWeight: 800 }}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ToolGlyph({ state }: { state: ToolCall["state"] }) {
  if (state === "ok") return <span>✓</span>;
  if (state === "error") return <span>✗</span>;
  return (
    <span className="inline-flex items-center gap-[2px]">
      <i className="block h-[3px] w-[3px] rounded-full" style={{ background: "currentColor" }} />
      <i className="block h-[3px] w-[3px] rounded-full" style={{ background: "currentColor" }} />
      <i className="block h-[3px] w-[3px] rounded-full" style={{ background: "currentColor" }} />
    </span>
  );
}

function ToolChip({ tool }: { tool: ToolCall }) {
  const tone =
    tool.state === "error"
      ? { fg: "#fb7185", bg: "rgba(251,113,133,0.12)", bd: "rgba(251,113,133,0.30)" }
      : tool.state === "running"
        ? { fg: "#fbbf24", bg: "rgba(251,191,36,0.12)", bd: "rgba(251,191,36,0.28)" }
        : { fg: "#34d399", bg: "rgba(52,211,153,0.12)", bd: "rgba(52,211,153,0.26)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold"
      style={{ color: tone.fg, background: tone.bg, border: `1px solid ${tone.bd}` }}
    >
      <ToolGlyph state={tool.state} />
      {toolLabel(tool.name)}
    </span>
  );
}

function ModelPill({ model }: { model: string }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-[2px] text-[11px] font-bold"
      style={{ color: MUTED, background: RAISED2, border: `1px solid ${BORDER}` }}
    >
      via {modelLabel(model)}
    </span>
  );
}

function MacroChip({ k, v }: { k: "p" | "f" | "c"; v: number }) {
  const m = MACRO[k];
  return (
    <span
      className="inline-flex items-baseline gap-0.5 rounded-full px-2 py-[2px] text-[11px] font-extrabold tabular-nums"
      style={{ color: m.fg, background: m.bg }}
    >
      {v}
      <span className="text-[9px] font-bold opacity-70">{k.toUpperCase()}</span>
    </span>
  );
}

/* avatars */
function AssistantAvatar() {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl"
      style={{
        background: ACCENT_SOFT,
        border: `1px solid ${ACCENT_LINE}`,
        color: ACCENT,
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      <BrandMark size={18} />
    </div>
  );
}
function UserAvatar() {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl text-[12px] font-extrabold"
      style={{
        background: RAISED,
        border: `1px solid ${BORDER2}`,
        color: TEXT,
        boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
      }}
    >
      {USER.initials}
    </div>
  );
}

/* the friendly rounded nutrition card */
function MacroCard({ table }: { table: MacroTable }) {
  const head = ["Item", "Cal", "P", "F", "C"];
  return (
    <div
      className="mt-3 overflow-hidden rounded-2xl"
      style={{
        background: BASE,
        border: `1px solid ${BORDER2}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        className="grid items-center gap-2 px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-wide"
        style={{
          gridTemplateColumns: "1fr 48px 40px 40px 40px",
          color: FAINT,
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        {head.map((h, i) => (
          <span key={h} className={i === 0 ? "text-left" : "text-right tabular-nums"}>
            {h}
          </span>
        ))}
      </div>
      {table.rows.map((r, i) => (
        <div
          key={r.item}
          className="grid items-center gap-2 px-4 py-3 text-[13px]"
          style={{
            gridTemplateColumns: "1fr 48px 40px 40px 40px",
            borderBottom: i < table.rows.length - 1 ? `1px solid ${BORDER}` : "none",
          }}
        >
          <span className="truncate font-bold" style={{ color: TEXT }}>
            {r.item}
          </span>
          <span className="text-right font-bold tabular-nums" style={{ color: TEXT }}>
            {r.cal}
          </span>
          <span className="text-right tabular-nums" style={{ color: MACRO.p.fg }}>
            {r.p}
          </span>
          <span className="text-right tabular-nums" style={{ color: MACRO.f.fg }}>
            {r.f}
          </span>
          <span className="text-right tabular-nums" style={{ color: MACRO.c.fg }}>
            {r.c}
          </span>
        </div>
      ))}
      {/* highlighted rounded Total row */}
      <div className="px-2 pb-2 pt-1">
        <div
          className="grid items-center gap-2 rounded-xl px-3 py-2.5 text-[13px]"
          style={{
            gridTemplateColumns: "1fr 48px 40px 40px 40px",
            background: ACCENT_SOFT,
            border: `1px solid ${ACCENT_LINE}`,
          }}
        >
          <span className="font-extrabold" style={{ color: TEXT }}>
            {table.total.item}
          </span>
          <span className="text-right font-extrabold tabular-nums" style={{ color: ACCENT }}>
            {table.total.cal}
          </span>
          <span className="flex justify-end">
            <MacroChip k="p" v={table.total.p} />
          </span>
          <span className="flex justify-end">
            <MacroChip k="f" v={table.total.f} />
          </span>
          <span className="flex justify-end">
            <MacroChip k="c" v={table.total.c} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* in-bubble rounded meal photo placeholder */
function MealPhoto() {
  return (
    <div
      className="mb-2 flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl"
      style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.10), rgba(255,255,255,0.02))",
        border: "1px solid rgba(255,255,255,0.16)",
      }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <circle cx="8.5" cy="8.5" r="1.8" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </div>
  );
}

/* ── bubbles ──────────────────────────────────────────────────────────── */

function UserBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="flex items-end justify-end gap-2.5">
      <div className="flex max-w-[78%] flex-col items-end">
        <div
          className="relative rounded-3xl rounded-br-lg px-4 py-3 text-[15px] leading-relaxed"
          style={{
            color: "#fff",
            background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT_DK} 100%)`,
            boxShadow: "0 8px 22px rgba(119,101,236,0.30), inset 0 1px 0 rgba(255,255,255,0.18)",
          }}
        >
          {m.image && <MealPhoto />}
          <p className="font-semibold">{m.text}</p>
        </div>
        <span className="mt-1 pr-1 text-[11px] font-semibold" style={{ color: FAINT }}>
          You
        </span>
      </div>
      <UserAvatar />
    </div>
  );
}

function AssistantBubble({ m }: { m: ChatMessage }) {
  return (
    <div className="flex items-end justify-start gap-2.5">
      <AssistantAvatar />
      <div className="flex max-w-[82%] flex-col items-start">
        <div className="mb-1.5 flex items-center gap-2 pl-1">
          <span className="text-[12px] font-extrabold" style={{ color: TEXT }}>
            Prog Strength
          </span>
          {m.model && <ModelPill model={m.model} />}
        </div>
        <div
          className="rounded-3xl rounded-bl-lg px-4 py-3 text-[15px] leading-relaxed"
          style={{
            color: TEXT,
            background: RAISED,
            border: `1px solid ${BORDER2}`,
            boxShadow: "0 8px 22px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {m.tools && m.tools.length > 0 && (
            <div className="mb-2.5 flex flex-wrap gap-1.5">
              {m.tools.map((t, i) => (
                <ToolChip key={i} tool={t} />
              ))}
            </div>
          )}
          {m.text && (
            <p className="font-medium">
              <RichText text={m.text} />
            </p>
          )}
          {m.table && <MacroCard table={m.table} />}
          {m.closing && (
            <p className="mt-2.5 text-[14px] font-semibold" style={{ color: MUTED }}>
              {m.closing}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* the friendly three-dot typing affordance */
function TypingBubble() {
  return (
    <div className="flex items-end justify-start gap-2.5">
      <AssistantAvatar />
      <div className="flex flex-col items-start">
        <div
          className="flex items-center gap-1.5 rounded-3xl rounded-bl-lg px-4 py-3.5"
          style={{
            background: RAISED,
            border: `1px solid ${BORDER2}`,
            boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="block h-2 w-2 rounded-full"
              style={{
                background: MUTED,
                animation: "smm-bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          ))}
        </div>
        <span className="mt-1 pl-1 text-[11px] font-semibold" style={{ color: FAINT }}>
          typing…
        </span>
      </div>
    </div>
  );
}

/* ── left rail (nav) ──────────────────────────────────────────────────── */
function Rail() {
  return (
    <aside
      className="flex w-[228px] shrink-0 flex-col"
      style={{ background: PANEL, borderRight: `1px solid ${BORDER}` }}
    >
      {/* brand */}
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-2xl"
          style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_LINE}`, color: ACCENT }}
        >
          <BrandMark size={20} />
        </div>
        <div className="leading-tight">
          <div className="text-[14px] font-extrabold" style={{ color: TEXT }}>
            Prog Strength
          </div>
          <div className="text-[11px] font-semibold" style={{ color: FAINT }}>
            AI Coach
          </div>
        </div>
      </div>

      {/* nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {NAV.map((item) => {
          const active = item.key === "chat";
          return (
            <a
              key={item.key}
              className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] transition-colors"
              style={
                active
                  ? {
                      background: ACCENT_SOFT,
                      color: TEXT,
                      border: `1px solid ${ACCENT_LINE}`,
                      fontWeight: 800,
                    }
                  : { color: MUTED, border: "1px solid transparent", fontWeight: 600 }
              }
            >
              <span
                style={{ color: active ? ACCENT : MUTED }}
                className="transition-colors group-hover:text-[var(--smm-accent)]"
              >
                <NavIcon k={item.key} size={18} />
              </span>
              <span className="transition-colors group-hover:text-[#eef0f4]">{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* user */}
      <div className="px-2.5 pb-3 pt-2">
        <div
          className="flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5"
          style={{ background: RAISED, border: `1px solid ${BORDER}` }}
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[11px] font-extrabold"
            style={{ background: ACCENT, color: "#fff" }}
          >
            {USER.initials}
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-bold" style={{ color: TEXT }}>
              {USER.name}
            </div>
            <div className="text-[11px] font-semibold" style={{ color: FAINT }}>
              Free plan
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ── conversation list (messenger-style left column) ──────────────────── */
function ConversationList() {
  return (
    <div
      className="flex w-[268px] shrink-0 flex-col"
      style={{ background: BASE, borderRight: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <h2 className="text-[16px] font-extrabold" style={{ color: TEXT }}>
          Chats
        </h2>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-full text-[16px] font-bold"
          style={{
            background: ACCENT,
            color: "#fff",
            boxShadow: "0 4px 12px rgba(119,101,236,0.35)",
          }}
        >
          +
        </button>
      </div>
      {/* search pill */}
      <div className="px-3 pb-2">
        <div
          className="flex items-center gap-2 rounded-full px-3 py-2"
          style={{ background: RAISED, border: `1px solid ${BORDER}`, color: FAINT }}
        >
          <NavIcon k="search" size={15} />
          <span className="text-[13px] font-semibold">Search chats…</span>
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-1">
        {SESSIONS.map((s) => (
          <a
            key={s.id}
            className="flex items-center gap-3 rounded-2xl px-2.5 py-2.5 transition-colors"
            style={
              s.active
                ? { background: ACCENT_SOFT, border: `1px solid ${ACCENT_LINE}` }
                : { background: "transparent", border: "1px solid transparent" }
            }
          >
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: s.active ? ACCENT_SOFT : RAISED,
                border: `1px solid ${s.active ? ACCENT_LINE : BORDER}`,
                color: s.active ? ACCENT : MUTED,
              }}
            >
              <BrandMark size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className="truncate text-[13.5px]"
                  style={{ color: s.active ? TEXT : "#cfd3da", fontWeight: s.active ? 800 : 700 }}
                >
                  {s.title}
                </span>
                <span className="shrink-0 text-[11px] font-semibold" style={{ color: FAINT }}>
                  {s.relativeTime}
                </span>
              </div>
              <span className="text-[12px] font-semibold" style={{ color: MUTED }}>
                {s.messageCount} messages
              </span>
            </div>
            {s.active && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: ACCENT, boxShadow: `0 0 0 3px ${ACCENT_SOFT}` }}
              />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ── header ───────────────────────────────────────────────────────────── */
function Header() {
  return (
    <header
      className="flex shrink-0 items-center justify-between px-5 py-3.5"
      style={{ background: PANEL, borderBottom: `1px solid ${BORDER}` }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <AssistantAvatar />
          <span
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full"
            style={{ background: "#34d399", border: `2px solid ${PANEL}` }}
          />
        </div>
        <div className="leading-tight">
          <div className="text-[16px] font-extrabold" style={{ color: TEXT }}>
            Chat
          </div>
          <div
            className="flex items-center gap-1.5 text-[12px] font-semibold"
            style={{ color: "#34d399" }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#34d399" }} />
            Online
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {/* Voice toggle — ON */}
        <div
          className="flex items-center gap-2 rounded-full px-3 py-1.5"
          style={{ background: RAISED, border: `1px solid ${BORDER}` }}
        >
          <span className="text-[12px] font-bold" style={{ color: TEXT }}>
            Voice
          </span>
          <span
            className="relative inline-flex h-5 w-9 items-center rounded-full px-0.5"
            style={{ background: ACCENT, boxShadow: "inset 0 1px 3px rgba(0,0,0,0.25)" }}
          >
            <span
              className="ml-auto block h-4 w-4 rounded-full"
              style={{ background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.35)" }}
            />
          </span>
        </div>

        <button
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors"
          style={{
            background: ACCENT,
            color: "#fff",
            boxShadow: "0 4px 14px rgba(119,101,236,0.32)",
          }}
        >
          <span className="text-[15px] leading-none">+</span> New chat
        </button>
        <button
          className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors"
          style={{ background: RAISED, color: TEXT, border: `1px solid ${BORDER}` }}
        >
          History
        </button>
      </div>
    </header>
  );
}

/* ── composer ─────────────────────────────────────────────────────────── */
function Composer() {
  return (
    <div
      className="shrink-0 px-5 py-4"
      style={{ background: PANEL, borderTop: `1px solid ${BORDER}` }}
    >
      <div
        className="flex items-center gap-2 rounded-full py-1.5 pl-2 pr-1.5"
        style={{
          background: RAISED,
          border: `1px solid ${BORDER2}`,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: MUTED }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-9.2 9.19a1 1 0 0 1-1.41-1.41l8.49-8.49" />
          </svg>
        </button>
        <input
          disabled
          placeholder="Message Prog Strength…"
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none placeholder:font-semibold"
          style={{ color: TEXT }}
        />
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ color: MUTED }}
        >
          <svg
            width="19"
            height="19"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v4" />
          </svg>
        </button>
        <button
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT_DK} 100%)`,
            color: "#fff",
            boxShadow: "0 6px 16px rgba(119,101,236,0.38)",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── labeled divider ──────────────────────────────────────────────────── */
function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5" style={{ background: BASE }}>
      <span className="h-px flex-1" style={{ background: BORDER }} />
      <span
        className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
        style={{ color: FAINT }}
      >
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: BORDER }} />
    </div>
  );
}

/* ── empty state hero ─────────────────────────────────────────────────── */
function EmptyState() {
  return (
    <div
      className="flex h-[560px] flex-col items-center justify-center px-6"
      style={{ background: BASE }}
    >
      <div
        className="mb-5 flex h-16 w-16 items-center justify-center rounded-3xl"
        style={{
          background: ACCENT_SOFT,
          border: `1px solid ${ACCENT_LINE}`,
          color: ACCENT,
          boxShadow: "0 12px 30px rgba(119,101,236,0.22)",
        }}
      >
        <BrandMark size={34} />
      </div>
      <h2 className="text-[22px] font-extrabold" style={{ color: TEXT }}>
        Ask about your training.
      </h2>
      <p className="mt-1.5 text-[14px] font-semibold" style={{ color: MUTED }}>
        Log meals, check progress, or plan your next session.
      </p>

      <div
        className="mt-6 flex w-full max-w-[560px] items-center gap-2 rounded-full py-2 pl-4 pr-2"
        style={{ background: RAISED, border: `1px solid ${BORDER2}` }}
      >
        <input
          disabled
          placeholder="Message Prog Strength…"
          className="flex-1 bg-transparent text-[15px] font-semibold outline-none"
          style={{ color: TEXT }}
        />
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: `linear-gradient(180deg, ${ACCENT} 0%, ${ACCENT_DK} 100%)`,
            color: "#fff",
            boxShadow: "0 5px 14px rgba(119,101,236,0.38)",
          }}
        >
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M22 2L11 13" />
            <path d="M22 2l-7 20-4-9-9-4 20-7z" />
          </svg>
        </button>
      </div>

      <div className="mt-6 flex max-w-[640px] flex-wrap justify-center gap-2.5">
        {EMPTY_PROMPTS.map((p) => (
          <button
            key={p}
            className="rounded-full px-4 py-2.5 text-[13.5px] font-bold transition-colors"
            style={{ background: RAISED, color: "#cfd3da", border: `1px solid ${BORDER}` }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── error region ─────────────────────────────────────────────────────── */
function ErrorState() {
  return (
    <div className="flex h-[240px] items-center px-6" style={{ background: BASE }}>
      <div className="w-full max-w-[620px]">
        <AssistantBubble m={ERROR_TURN} />
      </div>
    </div>
  );
}

/* ── root ─────────────────────────────────────────────────────────────── */
export default function SoftModernMessenger() {
  return (
    <div
      style={
        {
          fontFamily: "var(--font-soft)",
          background: BASE,
          "--smm-accent": ACCENT,
        } as React.CSSProperties
      }
      className="w-full"
    >
      {/* bounce keyframes for the typing dots */}
      <style>{`@keyframes smm-bounce{0%,80%,100%{transform:translateY(0);opacity:.5}40%{transform:translateY(-4px);opacity:1}}`}</style>

      {/* 1 — populated messenger shell */}
      <div className="flex h-[880px] overflow-hidden" style={{ background: BASE }}>
        <Rail />
        <ConversationList />

        <main className="flex min-w-0 flex-1 flex-col">
          <Header />

          {/* conversation scroll body */}
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
            <div className="mx-auto max-w-[720px] space-y-5">
              {CONVERSATION.map((m) =>
                m.role === "user" ? (
                  <UserBubble key={m.id} m={m} />
                ) : (
                  <AssistantBubble key={m.id} m={m} />
                ),
              )}
              <TypingBubble />
            </div>
          </div>

          <Composer />
        </main>
      </div>

      {/* 2 — empty state */}
      <Divider label="Empty state" />
      <EmptyState />

      {/* 3 — error state */}
      <Divider label="Error state" />
      <ErrorState />
    </div>
  );
}
