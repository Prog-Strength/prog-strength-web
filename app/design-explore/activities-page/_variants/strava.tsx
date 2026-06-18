"use client";

import { useState } from "react";
import {
  PERIODS,
  TABS,
  OVERVIEW_STATS_PRIMARY,
  OVERVIEW_STATS_SECONDARY,
  STEPS_SUMMARY,
  WORKOUTS_SUMMARY,
  WORKOUT_WEEKS,
  RUNNING_KPIS,
  RUNNING_SUMMARY,
  RUN_MONTHS,
  STEPS_KPIS,
  STEP_DAYS,
  STEP_LOG,
  STEPS_GOAL,
  weeksForPeriod,
  fmtDelta,
  type Period,
  type TabId,
  type StatTile,
  type WeekPoint,
} from "../_fixtures";

/* ------------------------------------------------------------------ *
 * strava-vibrant — training as energy. One self-contained file.
 * Dark base, multi-accent (lift = electric orange, run = vivid lime,
 * steps = hot magenta), full-bleed gradient hero stats, hand-rolled
 * inline-SVG charts. Throwaway DX mockup.
 * ------------------------------------------------------------------ */

const BG = "#0a0b0e";
const PANEL = "#15171d";
const PANEL_2 = "#1b1e26";
const STROKE = "#262a34";
const TEXT = "#f4f5f7";
const MUTED = "#8b909c";
const FAINT = "#5c616d";

// Domain hues
const LIFT = "#ff5a1f"; // electric orange
const LIFT_2 = "#ff8a3d";
const RUN = "#a3ff12"; // vivid lime
const RUN_2 = "#5cff8f";
const STEPS = "#ff2e93"; // hot magenta
const STEPS_2 = "#b14bff";
const GOLD = "#ffd23f"; // celebratory / PR

function domainColor(domain?: StatTile["domain"]): { a: string; b: string } {
  switch (domain) {
    case "lift":
      return { a: LIFT, b: LIFT_2 };
    case "run":
      return { a: RUN, b: RUN_2 };
    case "steps":
      return { a: STEPS, b: STEPS_2 };
    default:
      return { a: "#4f8bff", b: "#7c5cff" }; // cross-domain electric blue→violet
  }
}

const FONT = "var(--dx-font-archivo), system-ui, sans-serif";

export function StravaVariant(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  return (
    <div
      style={{
        minHeight: 820,
        background: `radial-gradient(1200px 600px at 80% -10%, rgba(255,90,31,0.10), transparent 60%), radial-gradient(1000px 500px at -10% 10%, rgba(255,46,147,0.08), transparent 55%), ${BG}`,
        color: TEXT,
        fontFamily: FONT,
        padding: "28px 28px 56px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Header />
        <TabBar tab={tab} setTab={setTab} />

        {/* Period filter — visible on every tab, drives the weekly chart */}
        <PeriodFilter period={period} setPeriod={setPeriod} />

        <div style={{ marginTop: 22 }}>
          {tab === "overview" && <OverviewTab period={period} />}
          {tab === "workouts" && <WorkoutsTab period={period} />}
          {tab === "running" && <RunningTab period={period} />}
          {tab === "steps" && <StepsTab />}
        </div>
      </div>
    </div>
  );
}

/* ============================ CHROME ============================== */

function Header(): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 18,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 14,
            background: `linear-gradient(135deg, ${LIFT}, ${STEPS})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 900,
            fontSize: 26,
            color: "#0a0b0e",
            boxShadow: "0 8px 26px rgba(255,90,31,0.35)",
          }}
        >
          P
        </div>
        <div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: 2,
              color: MUTED,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            Prog Strength
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, lineHeight: 1 }}>
            Activities
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: 0.4,
            color: GOLD,
            background: "rgba(255,210,63,0.10)",
            border: "1px solid rgba(255,210,63,0.30)",
            borderRadius: 999,
            padding: "8px 14px",
          }}
        >
          🔥 5 week streak
        </div>
      </div>
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }): React.JSX.Element {
  const active = TABS.find((t) => t.id === tab);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          gap: 4,
          background: PANEL,
          border: `1px solid ${STROKE}`,
          borderRadius: 16,
          padding: 5,
        }}
      >
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                border: "none",
                cursor: "pointer",
                borderRadius: 12,
                padding: "10px 18px",
                fontSize: 14,
                fontWeight: 800,
                fontFamily: FONT,
                letterSpacing: 0.2,
                color: on ? "#0a0b0e" : MUTED,
                background: on ? `linear-gradient(135deg, ${LIFT}, ${LIFT_2})` : "transparent",
                boxShadow: on ? "0 6px 18px rgba(255,90,31,0.35)" : "none",
                transition: "all .15s",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active?.action && (
        <button
          type="button"
          style={{
            border: `1px solid ${STROKE}`,
            cursor: "pointer",
            borderRadius: 12,
            padding: "11px 18px",
            fontSize: 13,
            fontWeight: 800,
            fontFamily: FONT,
            color: TEXT,
            background: PANEL_2,
          }}
        >
          {"+ " + active.action}
        </button>
      )}
    </div>
  );
}

function PeriodFilter({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
      {PERIODS.map((p) => {
        const on = p.id === period;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            title={p.label}
            style={{
              border: on ? `1px solid ${LIFT}` : `1px solid ${STROKE}`,
              cursor: "pointer",
              borderRadius: 999,
              padding: "7px 16px",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 0.6,
              fontFamily: FONT,
              color: on ? LIFT : MUTED,
              background: on ? "rgba(255,90,31,0.10)" : "transparent",
            }}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
}

/* ======================= SHARED PRIMITIVES ======================== */

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${STROKE}`,
        borderRadius: 24,
        padding: 22,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: 2,
        textTransform: "uppercase",
        fontWeight: 800,
        color: FAINT,
        margin: "26px 2px 12px",
      }}
    >
      {children}
    </div>
  );
}

/** Full-bleed gradient hero stat tile. */
function HeroStat({ tile }: { tile: StatTile }): React.JSX.Element {
  const c = domainColor(tile.domain);
  return (
    <div
      style={{
        borderRadius: 22,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(135deg, ${c.a}, ${c.b})`,
        boxShadow: `0 12px 30px ${hexA(c.a, 0.28)}`,
        minHeight: 116,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(120px 80px at 90% 0%, rgba(255,255,255,0.22), transparent 70%)",
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", color: "#0a0b0e" }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            opacity: 0.72,
          }}
        >
          {tile.label}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 10 }}>
          <span style={{ fontSize: 38, fontWeight: 900, letterSpacing: -1.2, lineHeight: 1 }}>
            {tile.value}
          </span>
          {tile.sub && (
            <span style={{ fontSize: 15, fontWeight: 800, opacity: 0.7 }}>{tile.sub}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Quieter secondary stat tile — domain hue as accent only. */
function MiniStat({ tile }: { tile: StatTile }): React.JSX.Element {
  const c = domainColor(tile.domain);
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${STROKE}`,
        borderRadius: 20,
        padding: 18,
        borderLeft: `4px solid ${c.a}`,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: MUTED,
        }}
      >
        {tile.label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
        <span
          style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1, color: TEXT }}
        >
          {tile.value}
        </span>
        {tile.sub && <span style={{ fontSize: 13, fontWeight: 700, color: c.a }}>{tile.sub}</span>}
      </div>
    </div>
  );
}

function hexA(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 14,
};

/* ========================== OVERVIEW ============================== */

function OverviewTab({ period }: { period: Period }): React.JSX.Element {
  return (
    <div>
      <div style={grid4}>
        {OVERVIEW_STATS_PRIMARY.map((t) => (
          <HeroStat key={t.key} tile={t} />
        ))}
      </div>

      <SectionTitle>Weekly Activity</SectionTitle>
      <Card style={{ padding: 24 }}>
        <WeeklyChart period={period} />
      </Card>

      <SectionTitle>Breakdown</SectionTitle>
      <div style={grid4}>
        {OVERVIEW_STATS_SECONDARY.map((t) => (
          <MiniStat key={t.key} tile={t} />
        ))}
      </div>

      <SectionTitle>Steps</SectionTitle>
      <StepsSummaryBanner />
    </div>
  );
}

function StepsSummaryBanner(): React.JSX.Element {
  const pct = STEPS_SUMMARY.pctOfGoal;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 28, padding: 24 }}>
      {/* radial progress ring */}
      <div style={{ position: "relative", width: 110, height: 110, flexShrink: 0 }}>
        <svg width={110} height={110} viewBox="0 0 110 110">
          <defs>
            <linearGradient id="stepsRing" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={STEPS} />
              <stop offset="100%" stopColor={STEPS_2} />
            </linearGradient>
          </defs>
          <circle cx={55} cy={55} r={46} fill="none" stroke={PANEL_2} strokeWidth={12} />
          <circle
            cx={55}
            cy={55}
            r={46}
            fill="none"
            stroke="url(#stepsRing)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${(2 * Math.PI * 46 * pct) / 100} ${2 * Math.PI * 46}`}
            transform="rotate(-90 55 55)"
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 26, fontWeight: 900, color: STEPS, lineHeight: 1 }}>{pct}%</span>
          <span style={{ fontSize: 10, fontWeight: 800, color: MUTED, letterSpacing: 0.5 }}>
            OF GOAL
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 44 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            Avg daily
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: TEXT }}>
            {STEPS_SUMMARY.avgDaily.toLocaleString()}
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            Daily goal
          </div>
          <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, color: FAINT }}>
            {STEPS_SUMMARY.goal.toLocaleString()}
          </div>
        </div>
      </div>
    </Card>
  );
}

/* --- Signature dual-series weekly chart (hand-rolled SVG) --- */

function WeeklyChart({ period }: { period: Period }): React.JSX.Element {
  const weeks = weeksForPeriod(period);
  const [hover, setHover] = useState<number | null>(null);

  const W = 1080;
  const H = 260;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 36;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const liftHrs = weeks.map((w) => w.liftMin / 60);
  const runHrs = weeks.map((w) => w.runMin / 60);
  const maxHrs = Math.max(1, ...liftHrs, ...runHrs);

  const n = weeks.length;
  // x position of each week (centered when sparse)
  const x = (i: number) => (n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
  const y = (hrs: number) => padT + innerH - (hrs / maxHrs) * innerH;

  function areaPath(vals: number[]): string {
    if (vals.length === 1) {
      // a small lozenge so single-point selections still read
      const cx = x(0);
      const cy = y(vals[0]);
      const base = padT + innerH;
      return `M ${cx - 60} ${base} L ${cx - 60} ${cy} L ${cx + 60} ${cy} L ${cx + 60} ${base} Z`;
    }
    let d = `M ${x(0)} ${padT + innerH}`;
    vals.forEach((v, i) => {
      d += ` L ${x(i)} ${y(v)}`;
    });
    d += ` L ${x(n - 1)} ${padT + innerH} Z`;
    return d;
  }

  function linePath(vals: number[]): string {
    if (vals.length === 1) {
      const cx = x(0);
      const cy = y(vals[0]);
      return `M ${cx - 60} ${cy} L ${cx + 60} ${cy}`;
    }
    return vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  }

  const restIdx = weeks.findIndex((w) => w.liftMin === 0 && w.runMin === 0);

  return (
    <div>
      {/* Legend + hover readout */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", gap: 18 }}>
          <Legend color={LIFT} label="Lifting" />
          <Legend color={RUN} label="Running" />
        </div>
        <TooltipReadout week={hover != null ? weeks[hover] : null} />
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="liftFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexA(LIFT, 0.55)} />
            <stop offset="100%" stopColor={hexA(LIFT, 0.02)} />
          </linearGradient>
          <linearGradient id="runFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={hexA(RUN, 0.45)} />
            <stop offset="100%" stopColor={hexA(RUN, 0.02)} />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH - g * innerH}
            y2={padT + innerH - g * innerH}
            stroke={STROKE}
            strokeWidth={1}
          />
        ))}

        {/* rest-week recovery band */}
        {restIdx >= 0 && n > 1 && (
          <g>
            <rect
              x={x(restIdx) - innerW / (n - 1) / 2.4}
              y={padT}
              width={innerW / (n - 1) / 1.2}
              height={innerH}
              fill="rgba(76,255,143,0.05)"
              stroke="rgba(76,255,143,0.25)"
              strokeWidth={1}
              strokeDasharray="4 4"
              rx={8}
            />
            <text
              x={x(restIdx)}
              y={padT + 16}
              textAnchor="middle"
              fontSize={11}
              fontWeight={800}
              fill={RUN_2}
              style={{ letterSpacing: 0.5 }}
            >
              REST
            </text>
          </g>
        )}

        {/* areas: lift behind, run in front; mix-blend keeps overlap legible */}
        <path d={areaPath(liftHrs)} fill="url(#liftFill)" />
        <path d={areaPath(runHrs)} fill="url(#runFill)" style={{ mixBlendMode: "screen" }} />

        <path
          d={linePath(liftHrs)}
          fill="none"
          stroke={LIFT}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <path
          d={linePath(runHrs)}
          fill="none"
          stroke={RUN}
          strokeWidth={3}
          strokeLinejoin="round"
        />

        {/* points + hover targets */}
        {weeks.map((w, i) => {
          const isRest = w.liftMin === 0 && w.runMin === 0;
          return (
            <g key={w.weekStartMs}>
              {!isRest && (
                <circle cx={x(i)} cy={y(liftHrs[i])} r={hover === i ? 6 : 4} fill={LIFT} />
              )}
              {!isRest && <circle cx={x(i)} cy={y(runHrs[i])} r={hover === i ? 6 : 4} fill={RUN} />}
              {/* hover hit area */}
              <rect
                x={n === 1 ? padL : x(i) - innerW / Math.max(1, n - 1) / 2}
                y={padT}
                width={n === 1 ? innerW : innerW / Math.max(1, n - 1)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              />
              {hover === i && (
                <line
                  x1={x(i)}
                  x2={x(i)}
                  y1={padT}
                  y2={padT + innerH}
                  stroke={hexA(TEXT, 0.18)}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}

        {/* x ticks */}
        {weeks.map((w, i) => (
          <text
            key={w.weekStartMs}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            fontSize={12}
            fontWeight={700}
            fill={hover === i ? TEXT : FAINT}
          >
            {w.tick}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 4,
          background: color,
          display: "inline-block",
        }}
      />
      <span style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{label}</span>
    </div>
  );
}

function TooltipReadout({ week }: { week: WeekPoint | null }): React.JSX.Element {
  if (!week) {
    return <span style={{ fontSize: 12, fontWeight: 700, color: FAINT }}>{"Hover a week"}</span>;
  }
  const isRest = week.liftMin === 0 && week.runMin === 0;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: PANEL_2,
        border: `1px solid ${STROKE}`,
        borderRadius: 12,
        padding: "8px 14px",
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 800, color: MUTED }}>{week.range}</span>
      {isRest ? (
        <span style={{ fontSize: 12, fontWeight: 800, color: RUN_2 }}>
          {"Recovery week · rest"}
        </span>
      ) : (
        <>
          <span style={{ fontSize: 12, fontWeight: 800, color: LIFT }}>
            {fmtHours(week.liftMin)} lift
          </span>
          <span style={{ fontSize: 12, fontWeight: 800, color: RUN }}>
            {fmtHours(week.runMin)} run
          </span>
        </>
      )}
    </div>
  );
}

function fmtHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/* --- Small trend sparkline (reused by Workouts / Running) --- */

function TrendSpark({ vals, color }: { vals: number[]; color: string }): React.JSX.Element {
  const W = 220;
  const H = 64;
  const max = Math.max(1, ...vals);
  const min = Math.min(...vals);
  const span = Math.max(1, max - min);
  const x = (i: number) => (vals.length === 1 ? W / 2 : (W * i) / (vals.length - 1));
  const y = (v: number) => H - 6 - ((v - min) / span) * (H - 16);
  const gid = `spark-${color.replace("#", "")}`;
  const line = vals.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  const area = `M ${x(0)} ${H} ${vals.map((v, i) => `L ${x(i)} ${y(v)}`).join(" ")} L ${x(vals.length - 1)} ${H} Z`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={hexA(color, 0.4)} />
          <stop offset="100%" stopColor={hexA(color, 0)} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ========================== WORKOUTS ============================== */

function WorkoutsTab({ period }: { period: Period }): React.JSX.Element {
  const weeks = weeksForPeriod(period);
  const trend = weeks.map((w) => w.liftMin / 60);
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) 1.4fr", gap: 14 }}>
        <MiniStat
          tile={{
            key: "tt",
            label: "Total time",
            value: WORKOUTS_SUMMARY.totalTime,
            domain: "lift",
          }}
        />
        <MiniStat
          tile={{
            key: "ss",
            label: "Sessions",
            value: String(WORKOUTS_SUMMARY.sessions),
            domain: "lift",
          }}
        />
        <MiniStat
          tile={{
            key: "pr",
            label: "PRs",
            value: String(WORKOUTS_SUMMARY.prs),
            sub: "🏆",
            domain: "lift",
          }}
        />
        <Card style={{ padding: 16, borderLeft: `4px solid ${LIFT}` }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            Lift hrs / week
          </div>
          <TrendSpark vals={trend} color={LIFT} />
        </Card>
      </div>

      <SectionTitle>Sessions</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {WORKOUT_WEEKS.map((wk) => (
          <div key={wk.id}>
            <WeekGroupHeader
              label={wk.label}
              range={wk.range}
              right={`${wk.totalTime} · ${wk.activities} ${wk.activities === 1 ? "activity" : "activities"}`}
              color={LIFT}
            />
            {wk.sessions.length === 0 ? (
              <RestWeekCard />
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {wk.sessions.map((s) => (
                  <SessionCardView key={s.id} s={s} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekGroupHeader({
  label,
  range,
  right,
  color,
}: {
  label: string;
  range: string;
  right: string;
  color: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        margin: "4px 4px 12px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: color,
            display: "inline-block",
          }}
        />
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.3 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: FAINT }}>{range}</span>
      </div>
      <span style={{ fontSize: 13, fontWeight: 800, color: MUTED }}>{right}</span>
    </div>
  );
}

function RestWeekCard(): React.JSX.Element {
  return (
    <div
      style={{
        borderRadius: 22,
        border: `1px dashed ${hexA(RUN, 0.4)}`,
        background: "rgba(76,255,143,0.04)",
        padding: "26px 24px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <span style={{ fontSize: 30 }}>🌙</span>
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: RUN_2 }}>{"Recovery week"}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: MUTED, marginTop: 3 }}>
          {"Planned rest — no sessions logged. Recovery is part of the program."}
        </div>
      </div>
    </div>
  );
}

function SessionCardView({ s }: { s: import("../_fixtures").SessionCard }): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL,
        border: s.isPR ? `1px solid ${hexA(GOLD, 0.5)}` : `1px solid ${STROKE}`,
        borderRadius: 22,
        padding: 20,
        position: "relative",
        overflow: "hidden",
        boxShadow: s.isPR ? `0 0 0 1px ${hexA(GOLD, 0.15)}, 0 10px 26px rgba(0,0,0,0.3)` : "none",
      }}
    >
      {s.isPR && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: `linear-gradient(90deg, ${GOLD}, ${LIFT})`,
          }}
        />
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: -0.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {s.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: FAINT, marginTop: 3 }}>{s.when}</div>
        </div>
        {s.isPR && (
          <span
            style={{
              flexShrink: 0,
              fontSize: 11,
              fontWeight: 900,
              letterSpacing: 0.6,
              color: "#0a0b0e",
              background: `linear-gradient(135deg, ${GOLD}, #ffb800)`,
              borderRadius: 999,
              padding: "5px 11px",
              boxShadow: `0 4px 14px ${hexA(GOLD, 0.4)}`,
            }}
          >
            🏆 PR
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 22, marginTop: 16 }}>
        <Metric label="Duration" value={s.duration} />
        <Metric label="Exercises" value={String(s.exercises)} />
        <Metric label="Volume" value={s.volume} sub="lb" color={LIFT} />
      </div>

      {s.note && (
        <div
          style={{
            marginTop: 14,
            fontSize: 13,
            fontWeight: 500,
            color: MUTED,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {s.note}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 1,
          color: FAINT,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 4 }}>
        <span style={{ fontSize: 19, fontWeight: 900, color: color ?? TEXT, letterSpacing: -0.3 }}>
          {value}
        </span>
        {sub && <span style={{ fontSize: 11, fontWeight: 700, color: color ?? MUTED }}>{sub}</span>}
      </div>
    </div>
  );
}

/* =========================== RUNNING ============================== */

function RunningTab({ period }: { period: Period }): React.JSX.Element {
  const weeks = weeksForPeriod(period);
  const trend = weeks.map((w) => w.runMin / 60);
  return (
    <div>
      <div style={grid4}>
        {RUNNING_KPIS.map((k) => (
          <RunKpiTile key={k.key} k={k} />
        ))}
      </div>

      <SectionTitle>This period</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr) 1.4fr", gap: 14 }}>
        <MiniStat
          tile={{
            key: "d",
            label: "Distance",
            value: RUNNING_SUMMARY.totalDistance,
            sub: "mi",
            domain: "run",
          }}
        />
        <MiniStat
          tile={{ key: "t", label: "Total time", value: RUNNING_SUMMARY.totalTime, domain: "run" }}
        />
        <MiniStat
          tile={{ key: "r", label: "Runs", value: String(RUNNING_SUMMARY.runs), domain: "run" }}
        />
        <Card style={{ padding: 16, borderLeft: `4px solid ${RUN}` }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1,
              color: MUTED,
              textTransform: "uppercase",
            }}
          >
            Run hrs / week
          </div>
          <TrendSpark vals={trend} color={RUN} />
        </Card>
      </div>

      <SectionTitle>Runs</SectionTitle>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {RUN_MONTHS.map((m) => (
          <div key={m.id}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                margin: "0 4px 14px",
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: -0.5 }}>{m.label}</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: RUN }}>{m.summary}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {m.weeks.map((wk) => (
                <div key={wk.id}>
                  <WeekGroupHeader
                    label={wk.label}
                    range={wk.range}
                    right={wk.summary}
                    color={RUN}
                  />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    {wk.runs.map((r) => (
                      <RunCardView key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RunKpiTile({ k }: { k: import("../_fixtures").RunningKPI }): React.JSX.Element {
  // Color logic that obviously extends to negative/null:
  const hasDelta = k.deltaPct != null;
  const up = (k.deltaPct ?? 0) >= 0;
  const deltaColor = !hasDelta ? FAINT : up ? RUN_2 : "#ff5470";
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${STROKE}`,
        borderRadius: 20,
        padding: 18,
        borderLeft: `4px solid ${RUN}`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 1,
            color: MUTED,
            textTransform: "uppercase",
          }}
        >
          {k.label}
        </span>
        {hasDelta && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 900,
              color: deltaColor,
              background: hexA(deltaColor, 0.12),
              borderRadius: 999,
              padding: "3px 8px",
            }}
          >
            {(up ? "▲ " : "▼ ") + fmtDelta(k.deltaPct as number)}
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 10 }}>
        <span
          style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.8, color: TEXT, lineHeight: 1 }}
        >
          {k.value}
        </span>
        {k.sub && <span style={{ fontSize: 12, fontWeight: 700, color: RUN }}>{k.sub}</span>}
      </div>
    </div>
  );
}

function RunCardView({ r }: { r: import("../_fixtures").RunCard }): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${STROKE}`,
        borderRadius: 22,
        padding: 20,
        borderTop: `3px solid ${RUN}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              letterSpacing: -0.2,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {r.name}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: FAINT, marginTop: 3 }}>{r.when}</div>
        </div>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🏃</span>
      </div>
      <div style={{ display: "flex", gap: 20, marginTop: 16, flexWrap: "wrap" }}>
        <Metric label="Distance" value={r.distance} color={RUN} />
        <Metric label="Time" value={r.time} />
        <Metric label="Pace" value={r.pace} />
        <Metric label="Avg HR" value={r.hr} />
      </div>
    </div>
  );
}

/* ============================ STEPS =============================== */

function StepsTab(): React.JSX.Element {
  return (
    <div>
      <div style={grid4}>
        {STEPS_KPIS.map((k) => (
          <MiniStat key={k.key} tile={{ ...k, domain: "steps" }} />
        ))}
      </div>

      <SectionTitle>Daily steps</SectionTitle>
      <Card style={{ padding: 24 }}>
        <StepsBarChart />
      </Card>

      <SectionTitle>Step log</SectionTitle>
      <StepLogTable />
    </div>
  );
}

function StepsBarChart(): React.JSX.Element {
  const W = 1080;
  const H = 280;
  const padT = 22;
  const padB = 44;
  const padX = 10;
  const innerH = H - padT - padB;
  const innerW = W - padX * 2;
  const max = Math.max(STEPS_GOAL * 1.15, ...STEP_DAYS.map((d) => d.steps));
  const goalY = padT + innerH - (STEPS_GOAL / max) * innerH;

  const slot = innerW / STEP_DAYS.length;
  const barW = slot * 0.5;

  return (
    <div>
      <div style={{ display: "flex", gap: 18, marginBottom: 14 }}>
        <Legend color={STEPS} label="Goal hit" />
        <Legend color={hexA(STEPS, 0.35)} label="Under goal" />
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span
            style={{
              width: 18,
              height: 0,
              borderTop: `2px dashed ${GOLD}`,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>
            Goal {STEPS_GOAL.toLocaleString()}
          </span>
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="overBar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={STEPS_2} />
            <stop offset="100%" stopColor={STEPS} />
          </linearGradient>
        </defs>

        {STEP_DAYS.map((d, i) => {
          const h = (d.steps / max) * innerH;
          const bx = padX + slot * i + (slot - barW) / 2;
          const by = padT + innerH - h;
          const win = d.state === "over" || d.state === "at";
          return (
            <g key={d.date}>
              <rect
                x={bx}
                y={by}
                width={barW}
                height={h}
                rx={8}
                fill={win ? "url(#overBar)" : hexA(STEPS, 0.28)}
                stroke={win ? "none" : hexA(STEPS, 0.4)}
                strokeWidth={1}
              />
              {d.state === "over" && (
                <text x={bx + barW / 2} y={by - 8} textAnchor="middle" fontSize={14}>
                  ✨
                </text>
              )}
              <text
                x={bx + barW / 2}
                y={H - 24}
                textAnchor="middle"
                fontSize={12}
                fontWeight={800}
                fill={win ? STEPS_2 : MUTED}
              >
                {(d.steps / 1000).toFixed(d.steps % 1000 === 0 ? 0 : 1) + "k"}
              </text>
              <text
                x={bx + barW / 2}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                fill={FAINT}
              >
                {d.dow}
              </text>
            </g>
          );
        })}

        {/* dashed goal reference line */}
        <line
          x1={padX}
          x2={W - padX}
          y1={goalY}
          y2={goalY}
          stroke={GOLD}
          strokeWidth={2}
          strokeDasharray="7 6"
        />
      </svg>
    </div>
  );
}

function StepLogTable(): React.JSX.Element {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 120px",
          padding: "14px 22px",
          borderBottom: `1px solid ${STROKE}`,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1,
          color: FAINT,
          textTransform: "uppercase",
        }}
      >
        <span>Date</span>
        <span>Steps</span>
        <span style={{ textAlign: "right" }}>Actions</span>
      </div>
      {STEP_LOG.map((row, i) => {
        const hit = row.steps >= STEPS_GOAL;
        return (
          <div
            key={row.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 120px",
              alignItems: "center",
              padding: "14px 22px",
              borderBottom: i === STEP_LOG.length - 1 ? "none" : `1px solid ${hexA(STROKE, 0.6)}`,
              background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.012)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{row.date}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 900,
                  color: hit ? STEPS : TEXT,
                  letterSpacing: -0.3,
                }}
              >
                {row.steps.toLocaleString()}
              </span>
              {hit && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: "#0a0b0e",
                    background: STEPS,
                    borderRadius: 999,
                    padding: "2px 7px",
                  }}
                >
                  GOAL
                </span>
              )}
            </span>
            <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <IconBtn label="Edit" hue={STEPS_2}>
                ✎
              </IconBtn>
              <IconBtn label="Delete" hue="#ff5470">
                🗑
              </IconBtn>
            </span>
          </div>
        );
      })}
    </Card>
  );
}

function IconBtn({
  children,
  label,
  hue,
}: {
  children: React.ReactNode;
  label: string;
  hue: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: `1px solid ${STROKE}`,
        background: PANEL_2,
        color: hue,
        cursor: "pointer",
        fontSize: 14,
        fontFamily: FONT,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </button>
  );
}
