/*
 * VARIANT — coach-branded
 * Idiom: Prog Strength's athletic identity maxed out — the agent is a hype COACH
 * with a name + badge, electric volt accent carrying the whole surface, scoreboard
 * macros. Looks like a premium training product (WHOOP / hype sportswear), not a chatbot.
 *
 * Axes:
 *  - Type scale: Archivo 800–900 display with big jumps (11px labels → 56px hero),
 *    tight tracking + UPPERCASE for coach/UI chrome; Sora for body prose.
 *  - Color logic: volt #c2f135 as a confident PRIMARY (coach badge, send, Total row,
 *    hype banner) on near-black #0c0d0a charcoal; saturated fills, not tints. Danger = #ff4d2e.
 *  - Spacing rhythm: punchy, dense gutters (gap-2/gap-3) with hard accent edges and
 *    4px left-bar "stat" framing; generous breathing only around hero moments.
 */
import {
  CONVERSATION,
  ERROR_TURN,
  EMPTY_PROMPTS,
  NAV,
  USER,
  modelLabel,
  toolLabel,
  type ChatMessage,
  type MacroTable,
  type ToolCall,
  type ToolState,
} from "./fixtures";
import { NavIcon } from "./nav-icons";
import { BrandMark } from "@/components/brand-mark";

const VOLT = "#c2f135";
const INK = "#0c0d0a";
const PANEL = "#141612";
const CARD = "#1b1d17";
const DANGER = "#ff4d2e";
const body = { fontFamily: "var(--font-coach-body)" };

/* ---------- small shared atoms ---------- */

function ToolStateGlyph({ state }: { state: ToolState }) {
  if (state === "ok") return <span className="text-[11px] font-black">✓</span>;
  if (state === "error") return <span className="text-[11px] font-black">✗</span>;
  return (
    <span className="flex gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-[3px] w-[3px] rounded-full bg-current"
          style={{ animation: `cbpulse 1s ${i * 0.15}s infinite ease-in-out` }}
        />
      ))}
    </span>
  );
}

function ToolChip({ tool }: { tool: ToolCall }) {
  const danger = tool.state === "error";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em]"
      style={{
        ...body,
        color: danger ? DANGER : VOLT,
        borderColor: danger ? "rgba(255,77,46,0.45)" : "rgba(194,241,53,0.4)",
        background: danger ? "rgba(255,77,46,0.1)" : "rgba(194,241,53,0.09)",
      }}
    >
      <ToolStateGlyph state={tool.state} />
      {toolLabel(tool.name)}
    </span>
  );
}

function ModelBadge({ model }: { model: string }) {
  return (
    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/35" style={body}>
      via {modelLabel(model)}
    </span>
  );
}

function CoachAvatar({ size = 38 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[10px] shadow-[0_0_24px_-6px_rgba(194,241,53,0.7)]"
      style={{ width: size, height: size, background: VOLT, color: INK }}
    >
      <BrandMark size={size * 0.62} />
    </span>
  );
}

/* renders **bold** inline spans inside assistant prose */
function InlineProse({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span
            key={i}
            className="font-black"
            style={{ fontFamily: "var(--font-coach)", color: VOLT }}
          >
            {p}
          </span>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/* ---------- scoreboard macro table ---------- */

function StatPill({ label }: { label: string }) {
  return (
    <span
      className="grid h-5 w-5 place-items-center rounded-[5px] text-[10px] font-black"
      style={{ background: "rgba(194,241,53,0.14)", color: VOLT }}
    >
      {label}
    </span>
  );
}

function Scoreboard({ table }: { table: MacroTable }) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: CARD }}
    >
      {/* header row */}
      <div
        className="grid items-center gap-2 px-4 py-2.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40"
        style={{ ...body, gridTemplateColumns: "1fr 56px 40px 40px 40px" }}
      >
        <span>Item</span>
        <span className="text-right">Cal</span>
        <span className="text-right">P</span>
        <span className="text-right">F</span>
        <span className="text-right">C</span>
      </div>
      {table.rows.map((r, i) => (
        <div
          key={i}
          className="grid items-center gap-2 border-t px-4 py-3"
          style={{
            borderColor: "rgba(255,255,255,0.05)",
            gridTemplateColumns: "1fr 56px 40px 40px 40px",
          }}
        >
          <span className="text-[13px] font-semibold text-white/85" style={body}>
            {r.item}
          </span>
          <span
            className="text-right text-[17px] font-black tabular-nums text-white"
            style={{ fontFamily: "var(--font-coach)" }}
          >
            {r.cal}
          </span>
          <span
            className="text-right text-[15px] font-bold tabular-nums text-white/70"
            style={body}
          >
            {r.p}
          </span>
          <span
            className="text-right text-[15px] font-bold tabular-nums text-white/70"
            style={body}
          >
            {r.f}
          </span>
          <span
            className="text-right text-[15px] font-bold tabular-nums text-white/70"
            style={body}
          >
            {r.c}
          </span>
        </div>
      ))}
      {/* hero TOTAL row */}
      <div
        className="grid items-center gap-2 px-4 py-3.5"
        style={{ background: VOLT, color: INK, gridTemplateColumns: "1fr 56px 40px 40px 40px" }}
      >
        <span
          className="text-[13px] font-black uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-coach)" }}
        >
          Total
        </span>
        <span
          className="text-right text-[22px] font-black leading-none tabular-nums"
          style={{ fontFamily: "var(--font-coach)" }}
        >
          {table.total.cal}
        </span>
        <span className="text-right text-[16px] font-black tabular-nums">{table.total.p}</span>
        <span className="text-right text-[16px] font-black tabular-nums">{table.total.f}</span>
        <span className="text-right text-[16px] font-black tabular-nums">{table.total.c}</span>
      </div>
      {/* macro stat pills strip */}
      <div
        className="flex items-center gap-4 border-t px-4 py-2"
        style={{ borderColor: "rgba(0,0,0,0.25)", background: "rgba(194,241,53,0.06)" }}
      >
        {[
          ["P", `${table.total.p}g`],
          ["F", `${table.total.f}g`],
          ["C", `${table.total.c}g`],
        ].map(([l, v]) => (
          <span key={l} className="flex items-center gap-1.5">
            <StatPill label={l} />
            <span className="text-[12px] font-bold text-white/70" style={body}>
              {v}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- hype motivational banner ---------- */

function HypeBanner({ text }: { text: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[12px] py-3 pl-4 pr-4"
      style={{ background: "rgba(194,241,53,0.1)" }}
    >
      <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: VOLT }} />
      <p
        className="text-[15px] font-extrabold leading-snug"
        style={{ fontFamily: "var(--font-coach)", color: VOLT, letterSpacing: "0.01em" }}
      >
        {text}
      </p>
    </div>
  );
}

/* ---------- meal photo placeholder ---------- */

function MealPhoto() {
  return (
    <div
      className="flex h-[88px] w-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-[12px] border-2"
      style={{
        borderColor: "rgba(194,241,53,0.55)",
        background: "linear-gradient(135deg,#23261c,#15170f)",
      }}
    >
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke={VOLT}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2" />
        <path d="M21 17l-5-5-9 7" />
      </svg>
      <span
        className="text-[9px] font-extrabold uppercase tracking-[0.16em]"
        style={{ ...body, color: VOLT }}
      >
        Meal
      </span>
    </div>
  );
}

/* ---------- message turns ---------- */

function UserTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/40"
          style={body}
        >
          {USER.name}
        </span>
        <span
          className="grid h-7 w-7 place-items-center rounded-[8px] text-[11px] font-black text-white/80"
          style={{ ...body, background: "#2a2d24", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {USER.initials}
        </span>
      </div>
      <div className="flex max-w-[78%] items-start gap-3">
        {m.image && <MealPhoto />}
        <div
          className="rounded-[14px] rounded-tr-[4px] px-4 py-3 text-[14px] font-medium leading-relaxed text-white/90"
          style={{ ...body, background: "#23261d", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {m.text}
        </div>
      </div>
    </div>
  );
}

function CoachTurn({ m }: { m: ChatMessage }) {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar />
      <div className="min-w-0 flex-1">
        {/* coach identity line */}
        <div className="mb-2 flex items-center gap-2.5">
          <span
            className="text-[13px] font-black uppercase tracking-[0.16em] text-white"
            style={{ fontFamily: "var(--font-coach)" }}
          >
            Coach
          </span>
          <span
            className="rounded-[4px] px-1.5 py-0.5 text-[8px] font-black uppercase tracking-[0.14em]"
            style={{ ...body, background: VOLT, color: INK }}
          >
            Prog Strength
          </span>
          {m.model && <ModelBadge model={m.model} />}
        </div>

        {/* tool chips */}
        {m.tools && m.tools.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {m.tools.map((t, i) => (
              <ToolChip key={i} tool={t} />
            ))}
          </div>
        )}

        {/* prose */}
        {m.text && (
          <p className="text-[15px] font-medium leading-relaxed text-white/85" style={body}>
            <InlineProse text={m.text} />
          </p>
        )}

        {/* scoreboard */}
        {m.table && (
          <div className="mt-3">
            <Scoreboard table={m.table} />
          </div>
        )}

        {/* hero closing hype line */}
        {m.closing && (
          <div className="mt-3">
            <HypeBanner text={m.closing} />
          </div>
        )}
      </div>
    </div>
  );
}

function Turn({ m }: { m: ChatMessage }) {
  return m.role === "user" ? <UserTurn m={m} /> : <CoachTurn m={m} />;
}

/* ---------- streaming "warming up" state ---------- */

function StreamingTurn() {
  return (
    <div className="flex items-start gap-3">
      <CoachAvatar />
      <div className="flex items-center gap-3 pt-1.5">
        <span
          className="flex items-center gap-1.5 rounded-[8px] px-3 py-2"
          style={{ background: "rgba(194,241,53,0.1)" }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full"
              style={{
                background: VOLT,
                animation: `cbpulse 1s ${i * 0.16}s infinite ease-in-out`,
              }}
            />
          ))}
        </span>
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.18em]"
          style={{ ...body, color: VOLT }}
        >
          Coach is warming up…
        </span>
      </div>
    </div>
  );
}

/* ---------- composer ---------- */

function IconBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="grid h-10 w-10 place-items-center rounded-[10px] text-white/55 transition-colors hover:bg-white/5 hover:text-white"
      style={{ border: "1px solid rgba(255,255,255,0.08)" }}
    >
      {children}
    </button>
  );
}

function Composer({ placeholder }: { placeholder: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-[16px] p-2.5"
      style={{ background: CARD, border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <IconBtn>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3 3 0 0 1 4.24 4.24l-8.49 8.49a1 1 0 0 1-1.41-1.41l7.78-7.78" />
        </svg>
      </IconBtn>
      <IconBtn>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <path d="M12 18v3" />
        </svg>
      </IconBtn>
      <div className="flex-1 px-2 text-[15px] font-medium text-white/35" style={body}>
        {placeholder}
      </div>
      <button
        className="grid h-11 w-11 place-items-center rounded-[12px] shadow-[0_0_22px_-4px_rgba(194,241,53,0.7)] transition-transform hover:scale-105"
        style={{ background: VOLT, color: INK }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12h14" />
          <path d="M13 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

/* ---------- left rail ---------- */

function Rail() {
  return (
    <aside
      className="flex w-[244px] shrink-0 flex-col"
      style={{ background: PANEL, borderRight: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* wordmark */}
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-5">
        <span
          className="grid h-9 w-9 place-items-center rounded-[10px]"
          style={{ background: VOLT, color: INK }}
        >
          <BrandMark size={22} />
        </span>
        <span
          className="text-[18px] font-black uppercase leading-none tracking-[0.04em] text-white"
          style={{ fontFamily: "var(--font-coach)" }}
        >
          Prog
          <span style={{ color: VOLT }}> Strength</span>
        </span>
      </div>

      {/* new chat */}
      <div className="px-3 pb-3">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-[10px] py-2.5 text-[12px] font-black uppercase tracking-[0.12em]"
          style={{ background: VOLT, color: INK }}
        >
          <span className="text-[15px] leading-none">+</span> New Chat
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 overflow-hidden px-3">
        {NAV.map((item) => {
          const active = item.key === "chat";
          return (
            <a
              key={item.key}
              className="group relative mb-0.5 flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-bold transition-colors"
              style={
                active
                  ? { background: "rgba(194,241,53,0.12)", color: VOLT }
                  : { color: "rgba(255,255,255,0.55)" }
              }
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full"
                  style={{ background: VOLT }}
                />
              )}
              <span className={active ? "" : "transition-colors group-hover:text-white"}>
                <NavIcon k={item.key} size={18} />
              </span>
              <span
                className={
                  active
                    ? "tracking-[0.02em]"
                    : "tracking-[0.02em] transition-colors group-hover:text-white"
                }
                style={body}
              >
                {item.label}
              </span>
            </a>
          );
        })}
      </nav>

      {/* user */}
      <div className="m-3 flex items-center gap-3 rounded-[12px] p-3" style={{ background: CARD }}>
        <span
          className="grid h-9 w-9 place-items-center rounded-[10px] text-[12px] font-black"
          style={{ background: VOLT, color: INK }}
        >
          {USER.initials}
        </span>
        <div className="min-w-0">
          <div
            className="truncate text-[13px] font-extrabold text-white"
            style={{ fontFamily: "var(--font-coach)" }}
          >
            {USER.name}
          </div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.12em]"
            style={{ ...body, color: VOLT }}
          >
            Athlete
          </div>
        </div>
      </div>
    </aside>
  );
}

/* ---------- header ---------- */

function Header() {
  return (
    <header
      className="flex items-center justify-between px-6 py-4"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.07)", background: "rgba(20,22,18,0.6)" }}
    >
      <div className="flex items-center gap-3">
        <h1
          className="text-[26px] font-black uppercase leading-none tracking-[0.02em] text-white"
          style={{ fontFamily: "var(--font-coach)" }}
        >
          Chat
        </h1>
        <span
          className="rounded-[5px] px-2 py-1 text-[9px] font-black uppercase tracking-[0.14em]"
          style={{ ...body, background: "rgba(194,241,53,0.12)", color: VOLT }}
        >
          Your Coach
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        {/* voice toggle — ON */}
        <span
          className="flex items-center gap-2 rounded-[10px] py-2 pl-3 pr-2 text-[11px] font-extrabold uppercase tracking-[0.12em]"
          style={{
            background: "rgba(194,241,53,0.12)",
            color: VOLT,
            border: "1px solid rgba(194,241,53,0.3)",
          }}
        >
          Voice
          <span
            className="relative grid h-5 w-9 place-items-center rounded-full"
            style={{ background: VOLT }}
          >
            <span
              className="absolute right-[3px] h-[15px] w-[15px] rounded-full"
              style={{ background: INK }}
            />
          </span>
        </span>
        <button
          className="rounded-[10px] px-3.5 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/65 transition-colors hover:text-white"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          History
        </button>
        <button
          className="rounded-[10px] px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.12em]"
          style={{ background: VOLT, color: INK }}
        >
          + New Chat
        </button>
      </div>
    </header>
  );
}

/* ---------- empty state hero ---------- */

function EmptyState() {
  return (
    <div className="flex h-full items-center justify-center px-8" style={{ background: INK }}>
      <div className="w-full max-w-[620px] text-center">
        <div className="mb-6 flex justify-center">
          <span
            className="grid h-20 w-20 place-items-center rounded-[22px] shadow-[0_0_60px_-10px_rgba(194,241,53,0.8)]"
            style={{ background: VOLT, color: INK }}
          >
            <BrandMark size={50} />
          </span>
        </div>
        <p
          className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.28em]"
          style={{ ...body, color: VOLT }}
        >
          Coach · Online
        </p>
        <h2
          className="mb-3 text-[52px] font-black uppercase leading-[0.95] tracking-[-0.01em] text-white"
          style={{ fontFamily: "var(--font-coach)" }}
        >
          Ask about
          <br />
          your training.
        </h2>
        <p className="mb-7 text-[15px] font-medium text-white/45" style={body}>
          Log meals, track lifts, hit your numbers. Let&apos;s get after it.
        </p>

        <div className="mb-6">
          <Composer placeholder="Message your coach…" />
        </div>

        <div className="flex flex-wrap justify-center gap-2.5">
          {EMPTY_PROMPTS.map((p) => (
            <span
              key={p}
              className="cursor-pointer rounded-[10px] px-4 py-2.5 text-[13px] font-bold text-white/75 transition-colors hover:text-white"
              style={{
                ...body,
                background: CARD,
                border: "1px solid rgba(194,241,53,0.22)",
              }}
            >
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------- error state ---------- */

function ErrorState() {
  const m = ERROR_TURN;
  return (
    <div className="flex h-full items-center px-8" style={{ background: INK }}>
      <div className="flex w-full items-start gap-3">
        <CoachAvatar />
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2.5">
            <span
              className="text-[13px] font-black uppercase tracking-[0.16em] text-white"
              style={{ fontFamily: "var(--font-coach)" }}
            >
              Coach
            </span>
            {m.model && <ModelBadge model={m.model} />}
          </div>
          {m.tools && (
            <div className="mb-3 flex gap-2">
              {m.tools.map((t, i) => (
                <ToolChip key={i} tool={t} />
              ))}
            </div>
          )}
          <div
            className="relative overflow-hidden rounded-[12px] py-3 pl-4 pr-4"
            style={{ background: "rgba(255,77,46,0.1)" }}
          >
            <span className="absolute inset-y-0 left-0 w-[4px]" style={{ background: DANGER }} />
            <p className="text-[15px] font-semibold leading-snug text-white/85" style={body}>
              {m.text}
            </p>
            <p
              className="mt-1 text-[12px] font-extrabold uppercase tracking-[0.12em]"
              style={{ ...body, color: DANGER }}
            >
              No excuses — let&apos;s run it back.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- divider ---------- */

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 px-1 py-5" style={{ background: INK }}>
      <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
      <span
        className="text-[10px] font-extrabold uppercase tracking-[0.24em] text-white/40"
        style={body}
      >
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: "rgba(255,255,255,0.1)" }} />
    </div>
  );
}

/* ---------- root ---------- */

export default function CoachBranded() {
  return (
    <div style={{ ...body, background: INK }} className="text-white">
      <style>{`@keyframes cbpulse{0%,100%{opacity:.3;transform:scale(.85)}50%{opacity:1;transform:scale(1)}}`}</style>

      {/* ===== 1. Populated branded shell ===== */}
      <div
        className="flex h-[900px] overflow-hidden rounded-[18px]"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col" style={{ background: INK }}>
          <Header />
          {/* conversation scroll region */}
          <div className="flex-1 overflow-hidden">
            <div className="flex flex-col gap-8 px-7 py-7">
              {CONVERSATION.map((m) => (
                <Turn key={m.id} m={m} />
              ))}
              <StreamingTurn />
            </div>
          </div>
          {/* composer dock */}
          <div className="px-6 pb-5 pt-2">
            <Composer placeholder="Message your coach…" />
            <p
              className="mt-2 text-center text-[10px] font-bold uppercase tracking-[0.16em] text-white/25"
              style={body}
            >
              Prog Strength Coach · Stay hungry
            </p>
          </div>
        </div>
      </div>

      {/* ===== 2. Empty state ===== */}
      <Divider label="Empty state" />
      <div
        className="h-[600px] overflow-hidden rounded-[18px]"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <EmptyState />
      </div>

      {/* ===== 3. Error state ===== */}
      <Divider label="Error state" />
      <div
        className="h-[240px] overflow-hidden rounded-[18px]"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <ErrorState />
      </div>
    </div>
  );
}
