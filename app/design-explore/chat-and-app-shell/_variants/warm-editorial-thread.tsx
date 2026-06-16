/*
 * VARIANT — warm-editorial-thread
 * Idiom: Claude's warmth and readability on dark — a reading-first editorial thread,
 *        umber-charcoal paper with cream type, one clay accent, the OPPOSITE of dense.
 *
 * Three axes:
 *   - type scale: Fraunces display serif for heroes/headings, Newsreader book serif for
 *     all prose at generous leading (leading-[1.7]+); a small uppercase taupe label register
 *     for nav/captions/bylines. Big jumps, few sizes.
 *   - color logic: warm-undertoned charcoal grounds (#1c1a17 shell / #211e1a paper), soft
 *     cream text (#ece6dd), muted taupe (#9a8f80) for secondary, ONE clay accent (#c8784f)
 *     used sparingly for the active mark, links, and the streaming pulse.
 *   - spacing rhythm: a calm ~680px centered reading column with roomy vertical air between
 *     turns; quiet left rail kept narrow so the column dominates.
 */

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
import { BrandMark } from "@/components/brand-mark";

/* ---- palette tokens (warm umber charcoal) ---------------------------- */
const SHELL = "#1c1a17";
const PAPER = "#211e1a";
const PAPER_RAISED = "#26221d";
const CREAM = "#ece6dd";
const TAUPE = "#9a8f80";
const TAUPE_DIM = "#6f665a";
const CLAY = "#c8784f";
const OCHRE = "#cf9f5d";
const HAIRLINE = "rgba(236,230,221,0.10)";

/* ---- tiny inline **bold** parser ------------------------------------- */
function RichText({ text }: { text: string }) {
  const parts = text.split("**");
  return (
    <p
      style={{
        fontFamily: "var(--font-we-body)",
        fontSize: 17,
        lineHeight: 1.75,
        color: "#d8cfc2",
        margin: 0,
      }}
    >
      {parts.map((seg, i) =>
        i % 2 === 1 ? (
          <strong key={i} style={{ color: CREAM, fontWeight: 600 }}>
            {seg}
          </strong>
        ) : (
          <span key={i}>{seg}</span>
        ),
      )}
    </p>
  );
}

/* ---- a small warm uppercase label ------------------------------------ */
function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-we-body)",
        fontSize: 10.5,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: TAUPE,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

/* ---- tool-call chip (warm, soft, not techy) -------------------------- */
function ToolChip({ tool }: { tool: ToolCall }) {
  const glyph = tool.state === "ok" ? "✓" : tool.state === "error" ? "✗" : "···";
  const tint = tool.state === "error" ? CLAY : tool.state === "running" ? OCHRE : OCHRE;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        padding: "4px 11px",
        borderRadius: 999,
        border: `1px solid ${HAIRLINE}`,
        background: "rgba(207,159,93,0.06)",
        fontFamily: "var(--font-we-body)",
        fontSize: 12.5,
        color: TAUPE,
      }}
    >
      <span style={{ color: tint, fontSize: 11.5, lineHeight: 1 }}>{glyph}</span>
      <span style={{ letterSpacing: "0.01em" }}>{toolLabel(tool.name)}</span>
    </span>
  );
}

/* ---- the paper-like nutrition table ---------------------------------- */
function MacroCard({ table }: { table: MacroTable }) {
  const num: React.CSSProperties = {
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
    fontFamily: "var(--font-we-body)",
  };
  const colHead: React.CSSProperties = {
    ...num,
    fontSize: 10.5,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: TAUPE_DIM,
    fontWeight: 400,
    paddingBottom: 10,
  };
  return (
    <figure
      style={{
        margin: "22px 0 4px",
        background: PAPER_RAISED,
        border: `1px solid ${HAIRLINE}`,
        borderRadius: 14,
        padding: "20px 24px 22px",
        boxShadow: "0 16px 40px -28px rgba(0,0,0,0.85), inset 0 1px 0 rgba(236,230,221,0.03)",
      }}
    >
      <figcaption style={{ marginBottom: 14, display: "flex", alignItems: "baseline", gap: 10 }}>
        <Eyebrow style={{ color: OCHRE }}>Lunch · Logged</Eyebrow>
        <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
      </figcaption>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...colHead, textAlign: "left" }}>Item</th>
            <th style={colHead}>Cal</th>
            <th style={colHead}>P</th>
            <th style={colHead}>F</th>
            <th style={colHead}>C</th>
          </tr>
        </thead>
        <tbody>
          {table.rows.map((r, i) => (
            <tr key={i} style={{ borderTop: `1px solid ${HAIRLINE}` }}>
              <td
                style={{
                  padding: "11px 0",
                  fontFamily: "var(--font-we-body)",
                  fontSize: 15,
                  color: CREAM,
                  lineHeight: 1.4,
                  paddingRight: 16,
                }}
              >
                {r.item}
              </td>
              <td style={{ ...num, fontSize: 15, color: CREAM, padding: "11px 0" }}>{r.cal}</td>
              <td style={{ ...num, fontSize: 15, color: TAUPE, padding: "11px 14px 11px 18px" }}>
                {r.p}
              </td>
              <td style={{ ...num, fontSize: 15, color: TAUPE, padding: "11px 14px" }}>{r.f}</td>
              <td style={{ ...num, fontSize: 15, color: TAUPE, padding: "11px 0 11px 14px" }}>
                {r.c}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: `2px solid rgba(236,230,221,0.22)` }}>
            <td
              style={{
                padding: "12px 0 2px",
                fontFamily: "var(--font-we-serif)",
                fontSize: 15.5,
                fontWeight: 600,
                color: CREAM,
              }}
            >
              {table.total.item}
            </td>
            <td
              style={{
                ...num,
                fontSize: 15.5,
                fontWeight: 600,
                color: OCHRE,
                padding: "12px 0 2px",
              }}
            >
              {table.total.cal}
            </td>
            <td
              style={{
                ...num,
                fontSize: 15.5,
                fontWeight: 600,
                color: CREAM,
                padding: "12px 14px 2px 18px",
              }}
            >
              {table.total.p}
            </td>
            <td
              style={{
                ...num,
                fontSize: 15.5,
                fontWeight: 600,
                color: CREAM,
                padding: "12px 14px 2px",
              }}
            >
              {table.total.f}
            </td>
            <td
              style={{
                ...num,
                fontSize: 15.5,
                fontWeight: 600,
                color: CREAM,
                padding: "12px 0 2px 14px",
              }}
            >
              {table.total.c}
            </td>
          </tr>
        </tbody>
      </table>
    </figure>
  );
}

/* ---- the warm meal-photo tile (no real asset) ------------------------ */
function MealPhoto() {
  return (
    <div
      style={{
        width: 132,
        height: 132,
        borderRadius: 12,
        flexShrink: 0,
        background:
          "linear-gradient(150deg, rgba(200,120,79,0.22), rgba(207,159,93,0.10) 55%, rgba(38,34,29,0.9))",
        border: `1px solid ${HAIRLINE}`,
        boxShadow: "0 10px 26px -20px rgba(0,0,0,0.9)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        color: TAUPE,
      }}
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke={OCHRE}
        strokeWidth="1.4"
        aria-hidden
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="10" r="1.8" />
        <path d="M21 16l-5-5L5 19" />
      </svg>
      <span style={{ fontFamily: "var(--font-we-body)", fontSize: 11, letterSpacing: "0.08em" }}>
        meal photo
      </span>
    </div>
  );
}

/* ---- a user turn — quiet, lightly set off ---------------------------- */
function UserTurn({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ margin: "34px 0" }}>
      <Eyebrow style={{ color: TAUPE_DIM, marginBottom: 8, display: "block" }}>You</Eyebrow>
      <div
        style={{
          borderLeft: `2px solid rgba(200,120,79,0.5)`,
          paddingLeft: 20,
          display: "flex",
          gap: 18,
          alignItems: "flex-start",
        }}
      >
        {msg.image && <MealPhoto />}
        <p
          style={{
            fontFamily: "var(--font-we-body)",
            fontSize: 17,
            lineHeight: 1.75,
            color: "#d8cfc2",
            fontStyle: "italic",
            margin: 0,
            paddingTop: msg.image ? 6 : 0,
          }}
        >
          {msg.text}
        </p>
      </div>
    </div>
  );
}

/* ---- an assistant turn — flowing prose, not a bubble ----------------- */
function AssistantTurn({ msg }: { msg: ChatMessage }) {
  return (
    <div style={{ margin: "34px 0" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <Eyebrow style={{ color: OCHRE }}>Prog Strength</Eyebrow>
        {msg.model && (
          <span
            style={{
              fontFamily: "var(--font-we-body)",
              fontSize: 12.5,
              fontStyle: "italic",
              color: TAUPE_DIM,
            }}
          >
            via {modelLabel(msg.model)}
          </span>
        )}
      </div>

      {msg.tools && msg.tools.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {msg.tools.map((t, i) => (
            <ToolChip key={i} tool={t} />
          ))}
        </div>
      )}

      {msg.text && <RichText text={msg.text} />}

      {msg.table && <MacroCard table={msg.table} />}

      {msg.closing && (
        <p
          style={{
            fontFamily: "var(--font-we-body)",
            fontSize: 17,
            lineHeight: 1.75,
            color: "#cfc6b8",
            margin: "16px 0 0",
          }}
        >
          {msg.closing}
        </p>
      )}
    </div>
  );
}

/* ---- the calm streaming / thinking state ----------------------------- */
function ThinkingState() {
  return (
    <div style={{ margin: "34px 0 8px" }}>
      <Eyebrow style={{ color: OCHRE, marginBottom: 10, display: "block" }}>Prog Strength</Eyebrow>
      <p
        style={{
          fontFamily: "var(--font-we-serif)",
          fontSize: 19,
          lineHeight: 1.5,
          color: TAUPE,
          fontStyle: "italic",
          margin: 0,
          display: "inline-flex",
          alignItems: "baseline",
          gap: 2,
        }}
      >
        Prog Strength is thinking
        <span style={{ display: "inline-flex", marginLeft: 2 }}>
          <span style={{ animation: "wet-pulse 1.4s ease-in-out infinite", color: CLAY }}>.</span>
          <span style={{ animation: "wet-pulse 1.4s ease-in-out 0.2s infinite", color: CLAY }}>
            .
          </span>
          <span style={{ animation: "wet-pulse 1.4s ease-in-out 0.4s infinite", color: CLAY }}>
            .
          </span>
        </span>
      </p>
    </div>
  );
}

/* ---- the left rail — labeled, low-chrome, warm ----------------------- */
function Rail() {
  return (
    <aside
      style={{
        width: 232,
        flexShrink: 0,
        background: "rgba(0,0,0,0.14)",
        borderRight: `1px solid ${HAIRLINE}`,
        display: "flex",
        flexDirection: "column",
        padding: "20px 16px",
      }}
    >
      {/* brand */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 22px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: "rgba(200,120,79,0.14)",
            border: `1px solid rgba(200,120,79,0.3)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: CLAY,
          }}
        >
          <BrandMark className="h-4 w-4" />
        </div>
        <span
          style={{
            fontFamily: "var(--font-we-serif)",
            fontSize: 18,
            fontWeight: 600,
            color: CREAM,
            letterSpacing: "0.01em",
          }}
        >
          Prog Strength
        </span>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
        {NAV.map((item) => {
          const active = item.key === "chat";
          return (
            <a
              key={item.key}
              href="#"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
                borderRadius: 9,
                textDecoration: "none",
                fontFamily: "var(--font-we-body)",
                fontSize: 14.5,
                color: active ? CREAM : TAUPE,
                background: active ? "rgba(200,120,79,0.12)" : "transparent",
                boxShadow: active ? `inset 0 0 0 1px rgba(200,120,79,0.22)` : "none",
                transition: "color 0.18s, background 0.18s",
              }}
              className="hover:bg-[rgba(236,230,221,0.05)] hover:text-[#ece6dd]"
            >
              <span style={{ color: active ? CLAY : TAUPE_DIM, display: "flex" }}>
                <NavIcon k={item.key} size={17} />
              </span>
              <span style={{ letterSpacing: "0.01em" }}>{item.label}</span>
            </a>
          );
        })}
      </nav>

      {/* user */}
      <div
        style={{
          marginTop: 14,
          paddingTop: 16,
          borderTop: `1px solid ${HAIRLINE}`,
          display: "flex",
          alignItems: "center",
          gap: 11,
          padding: "16px 8px 4px",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: "linear-gradient(140deg, #c8784f, #cf9f5d)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-we-body)",
            fontSize: 12.5,
            fontWeight: 600,
            color: "#1c1a17",
            letterSpacing: "0.04em",
          }}
        >
          {USER.initials}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontFamily: "var(--font-we-body)", fontSize: 14, color: CREAM }}>
            {USER.name}
          </span>
          <Eyebrow style={{ fontSize: 9.5, color: TAUPE_DIM }}>Member</Eyebrow>
        </div>
      </div>
    </aside>
  );
}

/* ---- the unobtrusive header ------------------------------------------ */
function Header() {
  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    padding: "6px 12px",
    borderRadius: 999,
    border: `1px solid ${HAIRLINE}`,
    fontFamily: "var(--font-we-body)",
    fontSize: 13,
    color: TAUPE,
    background: "transparent",
    textDecoration: "none",
  };
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 28px",
        borderBottom: `1px solid ${HAIRLINE}`,
        flexShrink: 0,
      }}
    >
      <h1
        style={{
          fontFamily: "var(--font-we-serif)",
          fontSize: 23,
          fontWeight: 600,
          color: CREAM,
          margin: 0,
          letterSpacing: "0.01em",
        }}
      >
        Chat
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Voice toggle — shown ON */}
        <span
          style={{
            ...pill,
            color: CREAM,
            background: "rgba(200,120,79,0.12)",
            border: `1px solid rgba(200,120,79,0.3)`,
          }}
        >
          <span
            style={{
              width: 28,
              height: 16,
              borderRadius: 999,
              background: CLAY,
              position: "relative",
              display: "inline-block",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "#1c1a17",
              }}
            />
          </span>
          Voice
        </span>
        <a href="#" style={pill} className="hover:text-[#ece6dd]">
          + New chat
        </a>
        <a href="#" style={pill} className="hover:text-[#ece6dd]">
          History
        </a>
      </div>
    </header>
  );
}

/* ---- the warm composer ----------------------------------------------- */
function Composer({ placeholder = "Reply to Prog Strength…" }: { placeholder?: string }) {
  return (
    <div style={{ padding: "16px 28px 24px", flexShrink: 0 }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: PAPER_RAISED,
            border: `1px solid ${HAIRLINE}`,
            borderRadius: 14,
            padding: "12px 12px 12px 18px",
            boxShadow: "0 18px 44px -30px rgba(0,0,0,0.9)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-we-body)",
              fontStyle: "italic",
              fontSize: 16,
              color: TAUPE_DIM,
              flex: 1,
            }}
          >
            {placeholder}
          </span>
          <button
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              border: "none",
              background: "linear-gradient(140deg, #c8784f, #cf9f5d)",
              color: "#1c1a17",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
              <path d="M5 12h14" />
              <path d="M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---- the warm history drawer (reading list of past sessions) --------- */
function HistoryDrawer() {
  return (
    <aside
      style={{
        width: 268,
        flexShrink: 0,
        background: SHELL,
        borderLeft: `1px solid ${HAIRLINE}`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "20px 22px 14px",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <Eyebrow>Recent</Eyebrow>
        <div
          style={{
            fontFamily: "var(--font-we-serif)",
            fontSize: 21,
            color: CREAM,
            marginTop: 4,
            lineHeight: 1.1,
          }}
        >
          Conversations
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {SESSIONS.map((s) => (
          <div
            key={s.id}
            style={{
              padding: "12px 12px",
              borderRadius: 12,
              marginBottom: 2,
              background: s.active ? PAPER_RAISED : "transparent",
              borderLeft: s.active ? `2px solid ${CLAY}` : "2px solid transparent",
            }}
          >
            <div
              style={{
                fontFamily: "var(--font-we-body)",
                fontSize: 14,
                color: s.active ? CREAM : "#cabfb0",
                lineHeight: 1.3,
                marginBottom: 5,
              }}
            >
              {s.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-we-body)",
                fontSize: 11.5,
                color: TAUPE_DIM,
                letterSpacing: "0.02em",
              }}
            >
              {s.messageCount} messages · {s.relativeTime}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

/* ====================================================================== */
export default function WarmEditorialThread() {
  return (
    <div
      style={{
        fontFamily: "var(--font-we-body)",
        color: CREAM,
        background: "#15130f",
      }}
    >
      <style>{`@keyframes wet-pulse{0%,100%{opacity:0.25}50%{opacity:1}}
        @keyframes wet-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}`}</style>

      {/* ============ 1 · POPULATED READING SHELL ============ */}
      <div
        style={{
          height: 880,
          overflow: "hidden",
          display: "flex",
          background: SHELL,
          borderRadius: 0,
        }}
      >
        <Rail />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Header />
          <div style={{ flex: 1, overflowY: "auto", background: PAPER }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "30px 28px 8px" }}>
              {/* a quiet dateline to set the editorial tone */}
              <div style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
                <Eyebrow style={{ color: TAUPE_DIM }}>Today · Lunch Macros Logged</Eyebrow>
                <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
              </div>

              {CONVERSATION.map((msg) =>
                msg.role === "user" ? (
                  <UserTurn key={msg.id} msg={msg} />
                ) : (
                  <AssistantTurn key={msg.id} msg={msg} />
                ),
              )}

              <ThinkingState />
              <div style={{ height: 8 }} />
            </div>
          </div>
          <Composer />
        </main>
        {/* History open — a calm right-side reading list of past sessions. */}
        <HistoryDrawer />
      </div>

      {/* ============ divider · Empty state ============ */}
      <SectionDivider label="Empty state" />

      {/* ============ 2 · EMPTY-STATE HERO ============ */}
      <div
        style={{
          height: 560,
          overflow: "hidden",
          display: "flex",
          background: SHELL,
        }}
      >
        <Rail />
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <Header />
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 28px",
            }}
          >
            <div style={{ width: "100%", maxWidth: 600, textAlign: "center" }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  margin: "0 auto 26px",
                  background: "rgba(200,120,79,0.12)",
                  border: `1px solid rgba(200,120,79,0.3)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: CLAY,
                }}
              >
                <BrandMark className="h-7 w-7" />
              </div>
              <h2
                style={{
                  fontFamily: "var(--font-we-serif)",
                  fontSize: 42,
                  fontWeight: 500,
                  lineHeight: 1.18,
                  color: CREAM,
                  margin: "0 0 14px",
                  letterSpacing: "-0.01em",
                }}
              >
                Ask about your training.
              </h2>
              <p
                style={{
                  fontFamily: "var(--font-we-body)",
                  fontSize: 17,
                  lineHeight: 1.7,
                  color: TAUPE,
                  margin: "0 auto 30px",
                  maxWidth: 440,
                }}
              >
                Log a meal, check your lifts, or talk through a deload. Start wherever you like — it
                reads like a letter, and answers like a coach.
              </p>

              {/* letter-like input */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  maxWidth: 500,
                  margin: "0 auto 26px",
                  background: PAPER_RAISED,
                  border: `1px solid ${HAIRLINE}`,
                  borderRadius: 14,
                  padding: "14px 14px 14px 20px",
                  boxShadow: "0 18px 44px -30px rgba(0,0,0,0.9)",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-we-body)",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: TAUPE_DIM,
                    flex: 1,
                  }}
                >
                  Dear coach, today I…
                </span>
                <button
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    border: "none",
                    background: "linear-gradient(140deg, #c8784f, #cf9f5d)",
                    color: "#1c1a17",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
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
                    <path d="M5 12h14" />
                    <path d="M13 6l6 6-6 6" />
                  </svg>
                </button>
              </div>

              {/* prompts as understated ghost links */}
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "10px 22px",
                  justifyContent: "center",
                }}
              >
                {EMPTY_PROMPTS.map((p) => (
                  <a
                    key={p}
                    href="#"
                    style={{
                      fontFamily: "var(--font-we-body)",
                      fontSize: 14.5,
                      color: TAUPE,
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                      textDecorationColor: "rgba(200,120,79,0.4)",
                      transition: "color 0.18s",
                    }}
                    className="hover:text-[#ece6dd]"
                  >
                    {p}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ============ divider · Error state ============ */}
      <SectionDivider label="Error state" />

      {/* ============ 3 · ERROR STATE ============ */}
      <div
        style={{
          height: 240,
          overflow: "hidden",
          display: "flex",
          background: SHELL,
        }}
      >
        <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <div style={{ maxWidth: 680, margin: "0 auto", padding: "0 28px", width: "100%" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
                <Eyebrow style={{ color: OCHRE }}>Prog Strength</Eyebrow>
                {ERROR_TURN.model && (
                  <span
                    style={{
                      fontFamily: "var(--font-we-body)",
                      fontSize: 12.5,
                      fontStyle: "italic",
                      color: TAUPE_DIM,
                    }}
                  >
                    via {modelLabel(ERROR_TURN.model)}
                  </span>
                )}
              </div>
              {ERROR_TURN.tools && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {ERROR_TURN.tools.map((t, i) => (
                    <ToolChip key={i} tool={t} />
                  ))}
                </div>
              )}
              <p
                style={{
                  fontFamily: "var(--font-we-body)",
                  fontSize: 17,
                  lineHeight: 1.75,
                  color: "#d8cfc2",
                  margin: 0,
                }}
              >
                {ERROR_TURN.text}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ---- thin labeled divider between screens ---------------------------- */
function SectionDivider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 28px",
        height: 56,
        background: "#15130f",
      }}
    >
      <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
      <Eyebrow style={{ color: TAUPE_DIM }}>{label}</Eyebrow>
      <span style={{ flex: 1, height: 1, background: HAIRLINE }} />
    </div>
  );
}
