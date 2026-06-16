/**
 * VARIANT — command-workbench
 * Idiom: Linear/Raycast/IDE — a dense, gridded, keyboard-first developer-grade workbench, the deliberate opposite of soft minimalism.
 *
 * Three axes:
 *  - Type scale: small + tight (10–13px); IBM Plex Sans for chrome, JetBrains Mono for ALL metadata (badges, tool rows, timestamps, kbd hints, table numbers). Sans/mono contrast is the signature.
 *  - Color logic: neutral graphite stack (#0e0f11 / #141619 / #1a1d21) with hairline #ffffff14 borders everywhere; ONE accent indigo #7c7cf0 for active/affordance, danger #f0716e for errors.
 *  - Spacing rhythm: 4px grid, ultra-tight padding, three persistent panes flanking the thread for maximal info density.
 */

import {
  CONVERSATION,
  EMPTY_PROMPTS,
  ERROR_TURN,
  NAV,
  SESSIONS,
  USER,
  modelLabel,
  type ChatMessage,
  type ToolCall,
} from "./fixtures";
import { NavIcon } from "./nav-icons";
import { BrandMark } from "@/components/brand-mark";

const ACCENT = "#7c7cf0";
const DANGER = "#f0716e";
const OK = "#5fcf8e";
const HAIRLINE = "rgba(255,255,255,0.08)";
const HAIRLINE_STRONG = "rgba(255,255,255,0.14)";
const BG_0 = "#0e0f11";
const BG_1 = "#141619";
const BG_2 = "#1a1d21";
const MONO = "var(--font-cw-mono)";

/* ---------- tiny shared atoms ---------- */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-[5px] text-[10px] leading-none text-neutral-400"
      style={{
        fontFamily: MONO,
        border: `1px solid ${HAIRLINE_STRONG}`,
        background: BG_2,
        boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.4)",
      }}
    >
      {children}
    </kbd>
  );
}

function StateGlyph({ state }: { state: ToolCall["state"] }) {
  const map = {
    running: { ch: "▶", color: ACCENT },
    ok: { ch: "✓", color: OK },
    error: { ch: "✗", color: DANGER },
  } as const;
  const { ch, color } = map[state];
  return (
    <span style={{ color, fontFamily: MONO }} className="text-[11px] leading-none">
      {ch}
    </span>
  );
}

/** mono tool-call row, terminal/IDE styled */
function ToolRow({ call, ms }: { call: ToolCall; ms: number }) {
  const danger = call.state === "error";
  return (
    <div
      className="flex items-center gap-2 rounded-[5px] px-2 py-[5px]"
      style={{
        fontFamily: MONO,
        border: `1px solid ${danger ? "rgba(240,113,110,0.35)" : HAIRLINE}`,
        background: danger ? "rgba(240,113,110,0.06)" : "rgba(255,255,255,0.015)",
      }}
    >
      <StateGlyph state={call.state} />
      <span className="text-[11px] text-neutral-200">{call.name}</span>
      <span className="text-[10px] text-neutral-600">·</span>
      <span className="text-[10px] text-neutral-500">{ms}ms</span>
      <span
        className="ml-auto text-[10px] uppercase tracking-wider"
        style={{ color: danger ? DANGER : "rgba(255,255,255,0.28)" }}
      >
        {call.state === "running" ? "running" : call.state === "ok" ? "200 ok" : "503 err"}
      </span>
    </div>
  );
}

/** model badge: `via Sonnet 4.6` in mono */
function ModelBadge({ model }: { model: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-[4px] px-[6px] py-[2px] text-[10px] leading-none"
      style={{
        fontFamily: MONO,
        border: `1px solid ${HAIRLINE}`,
        background: BG_2,
        color: "rgba(255,255,255,0.45)",
      }}
    >
      <span style={{ color: ACCENT }}>via</span> {modelLabel(model)}
    </span>
  );
}

/** inline **bold** macro parser */
function InlineText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <strong
            key={i}
            className="font-semibold"
            style={{ fontFamily: MONO, color: "#fff", fontSize: "0.92em" }}
          >
            {p}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function RoleGutter({ role, accent }: { role: "USER" | "AGENT"; accent?: boolean }) {
  return (
    <div className="flex w-[52px] shrink-0 flex-col items-start pt-[2px]">
      <span
        className="rounded-[3px] px-[5px] py-[2px] text-[9px] font-medium uppercase tracking-[0.12em] leading-none"
        style={{
          fontFamily: MONO,
          color: accent ? ACCENT : "rgba(255,255,255,0.4)",
          background: accent ? "rgba(124,124,240,0.1)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${accent ? "rgba(124,124,240,0.25)" : HAIRLINE}`,
        }}
      >
        {role}
      </span>
    </div>
  );
}

/** macro data-grid */
function MacroGrid({ table }: { table: NonNullable<ChatMessage["table"]> }) {
  const cols = ["Item", "Cal", "P", "F", "C"];
  return (
    <div
      className="mt-2 overflow-hidden rounded-[6px]"
      style={{ border: `1px solid ${HAIRLINE_STRONG}`, background: BG_0 }}
    >
      <div
        className="grid items-center text-[9px] uppercase tracking-[0.1em] text-neutral-500"
        style={{
          gridTemplateColumns: "1fr 56px 44px 44px 44px",
          fontFamily: MONO,
          background: BG_2,
          borderBottom: `1px solid ${HAIRLINE_STRONG}`,
        }}
      >
        {cols.map((c, i) => (
          <div
            key={c}
            className={`px-[10px] py-[6px] ${i === 0 ? "text-left" : "text-right"}`}
            style={i > 0 ? { borderLeft: `1px solid ${HAIRLINE}` } : undefined}
          >
            {c}
          </div>
        ))}
      </div>
      {table.rows.map((r) => (
        <div
          key={r.item}
          className="grid items-center text-[11px]"
          style={{
            gridTemplateColumns: "1fr 56px 44px 44px 44px",
            borderBottom: `1px solid ${HAIRLINE}`,
          }}
        >
          <div className="truncate px-[10px] py-[7px] text-neutral-200">{r.item}</div>
          {[r.cal, r.p, r.f, r.c].map((n, i) => (
            <div
              key={i}
              className="px-[10px] py-[7px] text-right text-neutral-400"
              style={{
                fontFamily: MONO,
                fontVariantNumeric: "tabular-nums",
                borderLeft: `1px solid ${HAIRLINE}`,
              }}
            >
              {n}
            </div>
          ))}
        </div>
      ))}
      <div
        className="grid items-center text-[11px]"
        style={{
          gridTemplateColumns: "1fr 56px 44px 44px 44px",
          background: "rgba(124,124,240,0.06)",
        }}
      >
        <div className="px-[10px] py-[7px] font-semibold text-white">{table.total.item}</div>
        {[table.total.cal, table.total.p, table.total.f, table.total.c].map((n, i) => (
          <div
            key={i}
            className="px-[10px] py-[7px] text-right font-semibold text-white"
            style={{
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
              borderLeft: `1px solid ${HAIRLINE}`,
            }}
          >
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

/** attachment thumbnail tile */
function AttachmentTile() {
  return (
    <div
      className="mt-2 inline-flex items-center gap-2 rounded-[6px] p-[6px] pr-[10px]"
      style={{ border: `1px solid ${HAIRLINE_STRONG}`, background: BG_2 }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]"
        style={{
          background: "linear-gradient(135deg,#2a2540,#1c2030)",
          border: `1px solid ${HAIRLINE}`,
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={ACCENT}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="9" cy="9" r="2" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </div>
      <div className="flex flex-col gap-[2px]">
        <span className="text-[11px] leading-none text-neutral-200" style={{ fontFamily: MONO }}>
          meal.jpg
        </span>
        <span className="text-[10px] leading-none text-neutral-500" style={{ fontFamily: MONO }}>
          image/jpeg · 2.1 MB
        </span>
      </div>
    </div>
  );
}

/* ---------- message row ---------- */

function MessageRow({ m, ms }: { m: ChatMessage; ms: number }) {
  const isUser = m.role === "user";
  return (
    <div className="flex gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <RoleGutter role={isUser ? "USER" : "AGENT"} accent={!isUser} />
      <div className="min-w-0 flex-1">
        {!isUser && (
          <div className="mb-2 flex items-center gap-2">
            {m.model && <ModelBadge model={m.model} />}
            <span className="text-[10px] text-neutral-600" style={{ fontFamily: MONO }}>
              ·
            </span>
            <span className="text-[10px] text-neutral-600" style={{ fontFamily: MONO }}>
              {ms}ms · 14:0{m.id.replace(/\D/g, "")} PM
            </span>
          </div>
        )}
        {m.text && (
          <p className="text-[13px] leading-[1.55] text-neutral-200">
            <InlineText text={m.text} />
          </p>
        )}
        {isUser && m.image && <AttachmentTile />}
        {m.tools && m.tools.length > 0 && (
          <div className="mt-2 flex flex-col gap-[5px]">
            {m.tools.map((t, i) => (
              <ToolRow key={i} call={t} ms={80 + i * 40} />
            ))}
          </div>
        )}
        {m.table && <MacroGrid table={m.table} />}
        {m.closing && (
          <p className="mt-2 text-[12px] leading-[1.5] text-neutral-400">{m.closing}</p>
        )}
      </div>
    </div>
  );
}

/* ---------- panes ---------- */

function NavRail() {
  return (
    <aside
      className="flex w-[188px] shrink-0 flex-col"
      style={{ background: BG_0, borderRight: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <div
        className="flex h-12 items-center gap-2 px-3"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[6px]"
          style={{ background: BG_2, border: `1px solid ${HAIRLINE_STRONG}` }}
        >
          <BrandMark className="h-4 w-4 text-white" />
        </div>
        <span className="text-[12px] font-semibold tracking-tight text-neutral-200">
          Prog Strength
        </span>
        <Kbd>⌘K</Kbd>
      </div>
      <nav className="flex flex-1 flex-col gap-[1px] overflow-y-auto px-2 py-2">
        <div
          className="px-1 pb-1 text-[9px] uppercase tracking-[0.14em] text-neutral-600"
          style={{ fontFamily: MONO }}
        >
          Workspace
        </div>
        {NAV.map((item, i) => {
          const active = item.key === "chat";
          return (
            <a
              key={item.key}
              className="group flex items-center gap-2 rounded-[6px] px-2 py-[6px] text-[12px] transition-colors"
              style={
                active
                  ? {
                      background: "rgba(124,124,240,0.12)",
                      color: "#fff",
                      border: `1px solid rgba(124,124,240,0.3)`,
                    }
                  : { color: "rgba(255,255,255,0.55)", border: "1px solid transparent" }
              }
            >
              <span
                style={{ color: active ? ACCENT : "rgba(255,255,255,0.4)" }}
                className="flex h-[18px] w-[18px] items-center justify-center group-hover:text-neutral-200"
              >
                <NavIcon k={item.key} size={16} />
              </span>
              <span className="truncate group-hover:text-neutral-200">{item.label}</span>
              {i < 9 && (
                <span
                  className="ml-auto text-[10px] text-neutral-700 opacity-0 group-hover:opacity-100"
                  style={{ fontFamily: MONO }}
                >
                  {i + 1}
                </span>
              )}
            </a>
          );
        })}
      </nav>
      <div
        className="flex items-center gap-2 px-3 py-3"
        style={{ borderTop: `1px solid ${HAIRLINE}` }}
      >
        <div
          className="flex h-7 w-7 items-center justify-center rounded-[6px] text-[10px] font-semibold text-white"
          style={{ background: "linear-gradient(135deg,#5e6ad2,#7c7cf0)", fontFamily: MONO }}
        >
          {USER.initials}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[12px] font-medium text-neutral-200">{USER.name}</span>
          <span className="text-[10px] text-neutral-500" style={{ fontFamily: MONO }}>
            online
          </span>
        </div>
        <span className="ml-auto h-[6px] w-[6px] rounded-full" style={{ background: OK }} />
      </div>
    </aside>
  );
}

function HistoryPane() {
  return (
    <aside
      className="flex w-[244px] shrink-0 flex-col"
      style={{ background: BG_0, borderLeft: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <div
        className="flex h-12 items-center gap-2 px-3"
        style={{ borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-neutral-300">
          Sessions
        </span>
        <span
          className="rounded-[3px] px-[5px] py-[1px] text-[10px] text-neutral-500"
          style={{ fontFamily: MONO, border: `1px solid ${HAIRLINE}` }}
        >
          {SESSIONS.length}
        </span>
        <Kbd>⌘H</Kbd>
      </div>
      <div className="flex flex-col gap-[2px] overflow-y-auto p-2">
        {SESSIONS.map((s) => (
          <a
            key={s.id}
            className="flex flex-col gap-[3px] rounded-[6px] px-[9px] py-2 transition-colors"
            style={
              s.active
                ? {
                    background: "rgba(124,124,240,0.1)",
                    border: `1px solid rgba(124,124,240,0.28)`,
                  }
                : { border: "1px solid transparent" }
            }
          >
            <div className="flex items-center gap-2">
              {s.active && (
                <span
                  className="h-[6px] w-[6px] shrink-0 rounded-full"
                  style={{ background: ACCENT }}
                />
              )}
              <span
                className="truncate text-[12px] font-medium"
                style={{ color: s.active ? "#fff" : "rgba(255,255,255,0.7)" }}
              >
                {s.title}
              </span>
            </div>
            <div
              className="flex items-center gap-2 text-[10px] text-neutral-500"
              style={{ fontFamily: MONO }}
            >
              <span>{s.messageCount} msgs</span>
              <span className="text-neutral-700">·</span>
              <span>{s.relativeTime}</span>
            </div>
          </a>
        ))}
      </div>
    </aside>
  );
}

function CommandHeader() {
  return (
    <header
      className="flex h-12 shrink-0 items-center gap-3 px-4"
      style={{ background: BG_1, borderBottom: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <div className="flex items-center gap-[6px] text-[12px]">
        <span className="text-neutral-500">Workspace</span>
        <span className="text-neutral-700">/</span>
        <span className="font-semibold text-neutral-100">Chat</span>
      </div>
      <span
        className="rounded-[4px] px-[6px] py-[2px] text-[10px] text-neutral-400"
        style={{ fontFamily: MONO, border: `1px solid ${HAIRLINE}`, background: BG_2 }}
      >
        Lunch Macros Logged
      </span>
      <div className="ml-auto flex items-center gap-2">
        {/* Voice toggle — ON */}
        <button
          className="flex items-center gap-[6px] rounded-[6px] px-[8px] py-[5px] text-[11px]"
          style={{
            border: `1px solid rgba(124,124,240,0.35)`,
            background: "rgba(124,124,240,0.12)",
            color: "#fff",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
          Voice
          <span
            className="rounded-[3px] px-[4px] py-[1px] text-[9px] uppercase tracking-wider"
            style={{ fontFamily: MONO, background: "rgba(124,124,240,0.25)", color: ACCENT }}
          >
            on
          </span>
        </button>
        <button
          className="flex items-center gap-[6px] rounded-[6px] px-[8px] py-[5px] text-[11px] text-neutral-200"
          style={{ border: `1px solid ${HAIRLINE_STRONG}`, background: BG_2 }}
        >
          + New chat
          <Kbd>⌘N</Kbd>
        </button>
        <button
          className="flex items-center gap-[6px] rounded-[6px] px-[8px] py-[5px] text-[11px] text-neutral-400"
          style={{ border: `1px solid ${HAIRLINE}`, background: BG_2 }}
        >
          History
          <Kbd>⌘H</Kbd>
        </button>
      </div>
    </header>
  );
}

function Composer() {
  return (
    <div
      className="shrink-0 px-4 py-3"
      style={{ background: BG_1, borderTop: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <div
        className="flex items-center gap-2 rounded-[8px] px-2 py-[7px]"
        style={{ background: BG_0, border: `1px solid ${HAIRLINE_STRONG}` }}
      >
        <button
          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-neutral-500 hover:text-neutral-200"
          style={{ border: `1px solid ${HAIRLINE}` }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="M17 8l-5-5-5 5" />
            <path d="M12 3v12" />
          </svg>
        </button>
        <span className="flex-1 text-[13px] text-neutral-500">Message Prog Strength…</span>
        <span className="text-[10px] text-neutral-600" style={{ fontFamily: MONO }}>
          ⏎ to send
        </span>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-neutral-500 hover:text-neutral-200"
          style={{ border: `1px solid ${HAIRLINE}` }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v3" />
          </svg>
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-[5px] text-white"
          style={{ background: ACCENT }}
        >
          <svg
            width="15"
            height="15"
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

/* ---------- streaming / thinking row ---------- */

function StreamingRow() {
  return (
    <div className="flex gap-3 px-4 py-3" style={{ background: "rgba(124,124,240,0.03)" }}>
      <RoleGutter role="AGENT" accent />
      <div className="min-w-0 flex-1">
        <div className="mb-2 flex items-center gap-2">
          <ModelBadge model="claude-sonnet-4-6" />
          <span
            className="inline-flex items-center gap-[5px] rounded-[4px] px-[6px] py-[2px] text-[10px]"
            style={{
              fontFamily: MONO,
              border: `1px solid rgba(124,124,240,0.3)`,
              background: "rgba(124,124,240,0.1)",
              color: ACCENT,
            }}
          >
            <span
              className="h-[6px] w-[6px] animate-pulse rounded-full"
              style={{ background: ACCENT }}
            />
            streaming
          </span>
        </div>
        <ToolRow call={{ name: "log_consumption", state: "running" }} ms={42} />
        <p className="mt-2 flex items-center text-[13px] leading-[1.55] text-neutral-300">
          Updating today&apos;s nutrition log
          <span
            className="ml-[2px] inline-block h-[14px] w-[7px] animate-pulse"
            style={{ background: ACCENT }}
          />
        </p>
      </div>
    </div>
  );
}

/* ---------- section labels ---------- */

function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-5">
      <span className="h-px flex-1" style={{ background: HAIRLINE_STRONG }} />
      <span
        className="text-[10px] uppercase tracking-[0.16em] text-neutral-500"
        style={{ fontFamily: MONO }}
      >
        {children}
      </span>
      <span className="h-px flex-1" style={{ background: HAIRLINE_STRONG }} />
    </div>
  );
}

/* ---------- empty state ---------- */

function EmptyState() {
  return (
    <div
      className="flex h-[520px] overflow-hidden rounded-[10px]"
      style={{ background: BG_0, border: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <NavRail />
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-[10px]"
          style={{ background: BG_2, border: `1px solid ${HAIRLINE_STRONG}` }}
        >
          <BrandMark className="h-6 w-6 text-white" />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold tracking-tight text-neutral-100">
          Ask about your training.
        </h2>
        <p className="mt-1 text-[12px] text-neutral-500">
          Log meals, check progress, or query the exercise catalog.
        </p>

        <div className="mt-5 w-full max-w-[520px]">
          <div
            className="flex items-center gap-2 rounded-[8px] px-3 py-[10px]"
            style={{
              background: BG_1,
              border: `1px solid ${HAIRLINE_STRONG}`,
              boxShadow: `0 0 0 3px rgba(124,124,240,0.08)`,
            }}
          >
            <span className="text-[13px]" style={{ color: ACCENT, fontFamily: MONO }}>
              /
            </span>
            <span className="flex-1 text-[13px] text-neutral-500">
              Type a command or ask anything…
            </span>
            <Kbd>⌘K</Kbd>
          </div>

          <div
            className="mt-3 overflow-hidden rounded-[8px]"
            style={{ border: `1px solid ${HAIRLINE_STRONG}`, background: BG_1 }}
          >
            <div
              className="flex items-center justify-between px-3 py-[6px]"
              style={{ borderBottom: `1px solid ${HAIRLINE}`, background: BG_2 }}
            >
              <span
                className="text-[9px] uppercase tracking-[0.14em] text-neutral-500"
                style={{ fontFamily: MONO }}
              >
                Suggested
              </span>
              <span
                className="flex items-center gap-1 text-[10px] text-neutral-600"
                style={{ fontFamily: MONO }}
              >
                <Kbd>↑</Kbd>
                <Kbd>↓</Kbd> navigate <Kbd>⏎</Kbd> run
              </span>
            </div>
            {EMPTY_PROMPTS.map((p, i) => (
              <div
                key={p}
                className="flex items-center gap-3 px-3 py-[9px]"
                style={{
                  borderBottom: i < EMPTY_PROMPTS.length - 1 ? `1px solid ${HAIRLINE}` : undefined,
                  background: i === 0 ? "rgba(124,124,240,0.08)" : undefined,
                }}
              >
                <span
                  className="text-[11px]"
                  style={{ color: i === 0 ? ACCENT : "rgba(255,255,255,0.3)", fontFamily: MONO }}
                >
                  {i === 0 ? "▶" : "›"}
                </span>
                <span
                  className="flex-1 text-[13px]"
                  style={{ color: i === 0 ? "#fff" : "rgba(255,255,255,0.7)" }}
                >
                  {p}
                </span>
                {i === 0 && <Kbd>⏎</Kbd>}
              </div>
            ))}
          </div>
        </div>
      </div>
      <HistoryPane />
    </div>
  );
}

/* ---------- error state ---------- */

function ErrorState() {
  return (
    <div
      className="h-[220px] overflow-hidden rounded-[10px]"
      style={{ background: BG_0, border: `1px solid ${HAIRLINE_STRONG}` }}
    >
      <div
        className="flex h-10 items-center gap-2 px-4"
        style={{ background: BG_1, borderBottom: `1px solid ${HAIRLINE}` }}
      >
        <span className="h-[6px] w-[6px] rounded-full" style={{ background: DANGER }} />
        <span className="text-[11px] font-medium text-neutral-300">Thread error</span>
        <span className="ml-auto text-[10px] text-neutral-600" style={{ fontFamily: MONO }}>
          exit 1
        </span>
      </div>
      <MessageRow m={ERROR_TURN} ms={61} />
    </div>
  );
}

/* ---------- main ---------- */

export default function CommandWorkbench() {
  return (
    <div
      style={{ fontFamily: "var(--font-cw)", background: "#08090a" }}
      className="p-6 text-neutral-200"
    >
      {/* 1. populated 3-pane workbench */}
      <div
        className="h-[880px] overflow-hidden rounded-[10px]"
        style={{
          background: BG_0,
          border: `1px solid ${HAIRLINE_STRONG}`,
          boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div className="flex h-full">
          <NavRail />
          <div className="flex min-w-0 flex-1 flex-col" style={{ background: BG_1 }}>
            <CommandHeader />
            <div className="flex-1 overflow-y-auto" style={{ background: BG_1 }}>
              {CONVERSATION.map((m, i) => (
                <MessageRow key={m.id} m={m} ms={60 + i * 30} />
              ))}
              <StreamingRow />
            </div>
            <Composer />
          </div>
          <HistoryPane />
        </div>
      </div>

      {/* 2. empty state */}
      <DividerLabel>Empty state</DividerLabel>
      <EmptyState />

      {/* 3. error state */}
      <DividerLabel>Error state</DividerLabel>
      <ErrorState />
    </div>
  );
}
