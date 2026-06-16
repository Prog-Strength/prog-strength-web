/**
 * VARIANT — minimal-canvas
 *
 * Idiom: ChatGPT's content-first calm. Vast negative space, near-monochrome
 * dark canvas, exactly one restrained accent. The conversation is the only
 * thing on screen — chrome whispers, type breathes.
 *
 * Three axes:
 *   - type scale:    near-flat — body 15px, hero 30px/light. Hierarchy from
 *                    WEIGHT (300/400/500/600) + space, never from size.
 *   - color logic:   monochrome ink on #0a0a0a. Text is white at descending
 *                    opacities (92 / 64 / 44 / 28). ONE accent — a soft
 *                    indigo (#a5b4fc) — used only for the send glyph, the
 *                    voice-ON dot, the active nav, and tool-OK checks.
 *   - spacing rhythm: generous 8px base, big vertical gaps between turns
 *                    (44px), centered ~680px reading measure on the canvas.
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

/* ── palette ─────────────────────────────────────────────────────────── */
const CANVAS = "#0a0a0a";
const INK_92 = "rgba(255,255,255,0.92)";
const INK_64 = "rgba(255,255,255,0.64)";
const INK_44 = "rgba(255,255,255,0.44)";
const INK_28 = "rgba(255,255,255,0.28)";
const INK_14 = "rgba(255,255,255,0.14)";
const HAIR = "rgba(255,255,255,0.08)";
const ACCENT = "#a5b4fc";

/* ── tiny inline glyphs (composer + state) ───────────────────────────── */
function Dots({ color = INK_44 }: { color?: string }) {
  return (
    <span className="inline-flex items-center gap-[3px]" aria-hidden>
      <span
        className="h-[5px] w-[5px] rounded-full mc-pulse"
        style={{ background: color, animationDelay: "0ms" }}
      />
      <span
        className="h-[5px] w-[5px] rounded-full mc-pulse"
        style={{ background: color, animationDelay: "180ms" }}
      />
      <span
        className="h-[5px] w-[5px] rounded-full mc-pulse"
        style={{ background: color, animationDelay: "360ms" }}
      />
    </span>
  );
}

function CheckGlyph({ color = ACCENT }: { color?: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 13l4 4L19 7"
        stroke={color}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CrossGlyph({ color }: { color: string }) {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.25" strokeLinecap="round" />
    </svg>
  );
}

function ToolStateGlyph({ state }: { state: ToolState }) {
  if (state === "ok") return <CheckGlyph />;
  if (state === "error") return <CrossGlyph color="#f4a3a3" />;
  return <Dots />;
}

/* tool-call chip — a hairline pill, monochrome, accent only on the check */
function ToolChip({ tool }: { tool: ToolCall }) {
  const errored = tool.state === "error";
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full px-3 py-[5px] text-[12.5px] font-medium"
      style={{
        border: `1px solid ${errored ? "rgba(244,163,163,0.22)" : HAIR}`,
        color: errored ? "#f4a3a3" : INK_64,
        letterSpacing: "0.01em",
      }}
    >
      <ToolStateGlyph state={tool.state} />
      {toolLabel(tool.name)}
    </span>
  );
}

/* model badge — the quietest possible attribution */
function ModelBadge({ model }: { model: string }) {
  return (
    <span className="text-[12px] font-normal" style={{ color: INK_28 }}>
      via {modelLabel(model)}
    </span>
  );
}

/* render **bold** spans inline, everything else plain */
function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold" style={{ color: INK_92 }}>
            {part}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* the meal-photo placeholder — a tasteful gradient tile, no real asset */
function MealPhoto() {
  return (
    <div
      className="relative mt-3 flex h-[112px] w-[150px] flex-col justify-end overflow-hidden rounded-2xl p-2.5"
      style={{
        background: "linear-gradient(135deg, #2a2620 0%, #3a322a 45%, #221f1b 100%)",
        border: `1px solid ${HAIR}`,
      }}
    >
      <svg
        className="absolute right-2.5 top-2.5"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        style={{ color: "rgba(255,255,255,0.55)" }}
      >
        <path
          d="M6 3v7M6 10a2 2 0 0 0 2-2V3M4 3v5M6 10v11M18 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4v9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="text-[11px] font-medium"
        style={{ color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}
      >
        meal photo
      </span>
    </div>
  );
}

/* the macro table — hairline rules, no boxes, a bold Total row */
function MacroTableView({ table }: { table: MacroTable }) {
  const cols = ["Cal", "P", "F", "C"] as const;
  return (
    <div className="mt-4 w-full max-w-[480px]">
      {/* header */}
      <div
        className="grid items-center pb-2.5 text-[11px] font-medium uppercase"
        style={{
          gridTemplateColumns: "1fr 56px 40px 40px 40px",
          color: INK_28,
          letterSpacing: "0.08em",
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <span>Item</span>
        {cols.map((c) => (
          <span key={c} className="text-right">
            {c}
          </span>
        ))}
      </div>
      {/* rows */}
      {table.rows.map((r) => (
        <div
          key={r.item}
          className="grid items-center py-2.5 text-[14px] tabular-nums"
          style={{
            gridTemplateColumns: "1fr 56px 40px 40px 40px",
            borderBottom: `1px solid ${HAIR}`,
            color: INK_64,
          }}
        >
          <span style={{ color: INK_92 }} className="pr-3 font-normal">
            {r.item}
          </span>
          <span className="text-right">{r.cal}</span>
          <span className="text-right">{r.p}</span>
          <span className="text-right">{r.f}</span>
          <span className="text-right">{r.c}</span>
        </div>
      ))}
      {/* total */}
      <div
        className="grid items-center pt-2.5 text-[14px] tabular-nums"
        style={{ gridTemplateColumns: "1fr 56px 40px 40px 40px" }}
      >
        <span className="font-semibold" style={{ color: INK_92 }}>
          {table.total.item}
        </span>
        <span className="text-right font-semibold" style={{ color: INK_92 }}>
          {table.total.cal}
        </span>
        <span className="text-right font-semibold" style={{ color: INK_92 }}>
          {table.total.p}
        </span>
        <span className="text-right font-semibold" style={{ color: INK_92 }}>
          {table.total.f}
        </span>
        <span className="text-right font-semibold" style={{ color: INK_92 }}>
          {table.total.c}
        </span>
      </div>
    </div>
  );
}

/* ── turns ───────────────────────────────────────────────────────────── */

/* user turn — a faint right-aligned treatment, hairline edge, no bubble */
function UserTurn({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex flex-col items-end">
      <div
        className="max-w-[80%] rounded-2xl px-4 py-3 text-[15px] font-normal"
        style={{
          color: INK_92,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${HAIR}`,
          lineHeight: 1.55,
        }}
      >
        {msg.text}
        {msg.image && <MealPhoto />}
      </div>
    </div>
  );
}

/* assistant turn — full-width flowing text, no bubble */
function AssistantTurn({ msg }: { msg: ChatMessage }) {
  return (
    <div className="flex flex-col items-start">
      {msg.tools && msg.tools.length > 0 && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {msg.tools.map((t, i) => (
            <ToolChip key={i} tool={t} />
          ))}
        </div>
      )}

      {msg.text && (
        <p className="text-[15px] font-normal" style={{ color: INK_92, lineHeight: 1.7 }}>
          <RichText text={msg.text} />
        </p>
      )}

      {msg.table && <MacroTableView table={msg.table} />}

      {msg.closing && (
        <p className="mt-4 text-[15px] font-normal" style={{ color: INK_64, lineHeight: 1.7 }}>
          {msg.closing}
        </p>
      )}

      {msg.model && (
        <div className="mt-3.5">
          <ModelBadge model={msg.model} />
        </div>
      )}
    </div>
  );
}

function Turn({ msg }: { msg: ChatMessage }) {
  return msg.role === "user" ? <UserTurn msg={msg} /> : <AssistantTurn msg={msg} />;
}

/* thinking indicator — a calm shimmer + pulsing dots, mid-generation */
function ThinkingTurn() {
  return (
    <div className="flex flex-col items-start">
      <div className="flex items-center gap-2.5">
        <Dots color={ACCENT} />
        <span className="text-[13px] font-normal" style={{ color: INK_44 }}>
          Thinking
        </span>
      </div>
      <div className="mt-3.5 h-[10px] w-[62%] rounded-full mc-shimmer" style={{ maxWidth: 420 }} />
      <div className="mt-2.5 h-[10px] w-[40%] rounded-full mc-shimmer" style={{ maxWidth: 280 }} />
    </div>
  );
}

/* ── icon rail ───────────────────────────────────────────────────────── */
function IconRail() {
  return (
    <nav
      className="flex h-full w-[56px] shrink-0 flex-col items-center py-4"
      style={{ borderRight: `1px solid ${HAIR}` }}
    >
      {/* brand */}
      <div
        className="flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ color: INK_92 }}
      >
        <BrandMark size={18} />
      </div>

      {/* destinations */}
      <div className="mt-5 flex flex-1 flex-col items-center gap-1">
        {NAV.map((item) => {
          const active = item.key === "chat";
          return (
            <a
              key={item.key}
              title={item.label}
              className="mc-nav flex h-9 w-9 items-center justify-center rounded-xl transition-colors"
              style={{
                color: active ? ACCENT : INK_44,
                background: active ? "rgba(165,180,252,0.10)" : "transparent",
              }}
            >
              <NavIcon k={item.key} size={18} />
            </a>
          );
        })}
      </div>

      {/* user avatar */}
      <div
        className="mt-4 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-semibold"
        title={USER.name}
        style={{
          color: INK_92,
          background: "rgba(255,255,255,0.06)",
          border: `1px solid ${HAIR}`,
        }}
      >
        {USER.initials}
      </div>
    </nav>
  );
}

/* ── header ──────────────────────────────────────────────────────────── */
function Header() {
  return (
    <header
      className="flex h-[56px] shrink-0 items-center justify-between px-6"
      style={{ borderBottom: `1px solid ${HAIR}` }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[14px] font-medium" style={{ color: INK_92 }}>
          Chat
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M6 9l6 6 6-6"
            stroke={INK_28}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div className="flex items-center gap-2">
        {/* voice toggle — ON */}
        <span
          className="inline-flex items-center gap-2 rounded-full px-3 py-[6px] text-[12.5px] font-medium"
          style={{
            color: ACCENT,
            background: "rgba(165,180,252,0.10)",
            border: `1px solid rgba(165,180,252,0.22)`,
          }}
        >
          <span className="h-[7px] w-[7px] rounded-full mc-pulse" style={{ background: ACCENT }} />
          Voice
        </span>

        <button
          className="rounded-full px-3 py-[6px] text-[12.5px] font-medium transition-colors"
          style={{ color: INK_64, border: `1px solid ${HAIR}` }}
        >
          + New chat
        </button>

        {/* History — slim unobtrusive affordance */}
        <button
          title="History"
          className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors"
          style={{ color: INK_44, border: `1px solid ${HAIR}` }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 12a9 9 0 1 0 3-6.7L3 8M3 4v4h4M12 7v5l3 2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

/* ── composer pill ───────────────────────────────────────────────────── */
function Composer() {
  return (
    <div className="px-6 pb-7 pt-4">
      <div className="mx-auto w-full max-w-[680px]">
        <div
          className="flex items-center gap-3 rounded-full px-5 py-3"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${INK_14}`,
          }}
        >
          {/* attach */}
          <button title="Attach" style={{ color: INK_44 }} aria-hidden>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 11.5l-8.5 8.5a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.6 1.6 0 0 1-2.3-2.3l7.8-7.8"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <span className="flex-1 text-[15px] font-normal" style={{ color: INK_44 }}>
            Message Prog Strength…
          </span>

          {/* mic */}
          <button title="Voice" style={{ color: INK_44 }} aria-hidden>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect
                x="9"
                y="3"
                width="6"
                height="11"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.6"
              />
              <path
                d="M5 11a7 7 0 0 0 14 0M12 18v3"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          {/* send — the one accent moment */}
          <button
            title="Send"
            className="flex h-9 w-9 items-center justify-center rounded-full"
            style={{ background: ACCENT, color: CANVAS }}
            aria-hidden
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 19V5M5 12l7-7 7 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── section divider ─────────────────────────────────────────────────── */
function LabeledDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 px-8 py-7" style={{ background: CANVAS }}>
      <div className="h-px flex-1" style={{ background: HAIR }} />
      <span
        className="text-[11px] font-medium uppercase"
        style={{ color: INK_28, letterSpacing: "0.16em" }}
      >
        {label}
      </span>
      <div className="h-px flex-1" style={{ background: HAIR }} />
    </div>
  );
}

/* ── empty-state hero ────────────────────────────────────────────────── */
function EmptyHero() {
  return (
    <div className="flex h-full w-full">
      <IconRail />
      <div className="flex flex-1 flex-col">
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <div className="flex w-full max-w-[640px] flex-col items-center">
            {/* P mark */}
            <div className="flex h-12 w-12 items-center justify-center" style={{ color: INK_92 }}>
              <BrandMark size={32} />
            </div>

            <h1
              className="mt-7 text-center text-[30px] font-light"
              style={{ color: INK_92, letterSpacing: "-0.01em" }}
            >
              Ask about your training.
            </h1>

            {/* the single prominent input pill */}
            <div className="mt-9 w-full">
              <div
                className="flex items-center gap-3 rounded-[26px] px-5 py-4"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${INK_14}`,
                }}
              >
                <span className="flex-1 text-[15px] font-normal" style={{ color: INK_44 }}>
                  Message Prog Strength…
                </span>
                <button
                  className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: ACCENT, color: CANVAS }}
                  aria-hidden
                >
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 19V5M5 12l7-7 7 7"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {/* inline action chips */}
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {EMPTY_PROMPTS.map((p) => (
                  <button
                    key={p}
                    className="mc-chip rounded-full px-3.5 py-2 text-[13px] font-normal transition-colors"
                    style={{ color: INK_64, border: `1px solid ${HAIR}` }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── error region ────────────────────────────────────────────────────── */
function ErrorRegion() {
  return (
    <div className="flex w-full items-center px-6" style={{ background: CANVAS, height: "100%" }}>
      <div className="mx-auto w-full max-w-[680px]">
        <AssistantTurn msg={ERROR_TURN} />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════ */
export default function MinimalCanvas() {
  return (
    <div style={{ fontFamily: "var(--font-mc)", background: CANVAS }}>
      <style>{`
        @keyframes mc-pulse-kf { 0%,100% { opacity:0.3; } 50% { opacity:1; } }
        .mc-pulse { animation: mc-pulse-kf 1.3s ease-in-out infinite; }
        @keyframes mc-shimmer-kf { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .mc-shimmer {
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 200% 100%;
          animation: mc-shimmer-kf 1.8s linear infinite;
        }
        .mc-nav:hover { color: rgba(255,255,255,0.85) !important; background: rgba(255,255,255,0.05) !important; }
        .mc-chip:hover { color: rgba(255,255,255,0.92) !important; background: rgba(255,255,255,0.04); }
      `}</style>

      {/* 1 ── populated app shell ─────────────────────────────────── */}
      <div className="h-[860px] overflow-hidden" style={{ background: CANVAS }}>
        <div className="flex h-full w-full">
          <IconRail />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />

            {/* centered conversation, scroll region */}
            <div className="flex-1 overflow-y-auto px-6 py-10">
              <div className="mx-auto flex w-full max-w-[680px] flex-col gap-11">
                {CONVERSATION.map((msg) => (
                  <Turn key={msg.id} msg={msg} />
                ))}
                <ThinkingTurn />
              </div>
            </div>

            <Composer />
          </div>
        </div>
      </div>

      {/* 2 ── divider ─────────────────────────────────────────────── */}
      <LabeledDivider label="Empty state" />

      {/* 3 ── empty-state hero ────────────────────────────────────── */}
      <div className="h-[560px] overflow-hidden" style={{ background: CANVAS }}>
        <EmptyHero />
      </div>

      {/* 4 ── divider ─────────────────────────────────────────────── */}
      <LabeledDivider label="Error state" />

      {/* 5 ── error turn ──────────────────────────────────────────── */}
      <div className="h-[240px] overflow-hidden" style={{ background: CANVAS }}>
        <ErrorRegion />
      </div>
    </div>
  );
}
