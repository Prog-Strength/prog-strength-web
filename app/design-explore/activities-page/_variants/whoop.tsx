"use client";

import { useState } from "react";
import {
  PERIODS,
  TABS,
  OVERVIEW_STATS_PRIMARY,
  OVERVIEW_STATS_SECONDARY,
  STEPS_SUMMARY,
  WEEKLY,
  weeksForPeriod,
  WORKOUTS_SUMMARY,
  WORKOUT_WEEKS,
  RUNNING_KPIS,
  RUNNING_SUMMARY,
  RUN_MONTHS,
  STEPS_KPIS,
  STEPS_GOAL,
  STEP_DAYS,
  STEP_LOG,
  fmtDelta,
  type Period,
  type TabId,
  type WeekPoint,
} from "../_fixtures";

/* ------------------------------------------------------------------ */
/* Palette — near-black charcoal field, ONE continuous signal ramp.    */
/* ------------------------------------------------------------------ */

const BG = "#0a0b0d";
const PANEL = "#121316";
const PANEL_2 = "#16181c";
const LINE = "#212327";
const LINE_SOFT = "#1a1c20";
const INK = "#e8eaed";
const INK_MID = "#9a9ea6";
const INK_DIM = "#5c6068";
const GRID = "#26282d";

/** Recovery ramp: low (red) -> amber -> green (high). Single signal language. */
function ramp(v: number): string {
  const t = Math.max(0, Math.min(100, v)) / 100;
  // anchors: 0 red, 0.5 amber, 1 green
  const stops: [number, [number, number, number]][] = [
    [0, [255, 73, 92]], // #ff495c red
    [0.5, [255, 184, 46]], // #ffb82e amber
    [1, [22, 224, 137]], // #16e089 green
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (t >= stops[i][0] && t <= stops[i + 1][0]) {
      a = stops[i];
      b = stops[i + 1];
      break;
    }
  }
  const span = b[0] - a[0] || 1;
  const f = (t - a[0]) / span;
  const c = a[1].map((ch, i) => Math.round(ch + (b[1][i] - ch) * f));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const FONT = "var(--dx-font-inter), system-ui, sans-serif";

/* ------------------------------------------------------------------ */
/* Ring — SVG stroke-dasharray gauge, the hero element.                */
/* ------------------------------------------------------------------ */

type RingProps = {
  size: number;
  stroke: number;
  pct: number; // 0..100
  /** main centered value text */
  value: string;
  /** small caption under value */
  caption?: string;
  /** if set, color the ring by this 0..100 signal instead of pct */
  signal?: number;
};

function Ring({ size, stroke, pct, value, caption, signal }: RingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  const col = ramp(signal ?? clamped);
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ display: "block", transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={LINE} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={col}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          style={{ filter: `drop-shadow(0 0 4px ${col}55)` }}
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
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: size > 120 ? 30 : 17,
            fontWeight: 700,
            color: INK,
            letterSpacing: -0.5,
          }}
        >
          {value}
        </span>
        {caption && (
          <span
            style={{ fontSize: 9.5, color: INK_DIM, textTransform: "uppercase", letterSpacing: 1 }}
          >
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small shared atoms.                                                 */
/* ------------------------------------------------------------------ */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        color: INK_DIM,
        textTransform: "uppercase",
        letterSpacing: 1.1,
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${LINE}`,
        borderRadius: 12,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Tight metric-label-value triplet cell. */
function StatCell({
  label,
  value,
  sub,
  signal,
}: {
  label: string;
  value: string;
  sub?: string;
  signal?: number;
}) {
  const dot = signal !== undefined ? ramp(signal) : INK_DIM;
  return (
    <div
      style={{
        background: PANEL_2,
        border: `1px solid ${LINE_SOFT}`,
        borderRadius: 10,
        padding: "10px 11px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 5, background: dot, flexShrink: 0 }} />
        <Label>{label}</Label>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 19, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
          {value}
        </span>
        {sub && <span style={{ fontSize: 11, color: INK_MID }}>{sub}</span>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signature dual-series weekly chart (Lifting vs Running, hours).     */
/* ------------------------------------------------------------------ */

function WeeklyChart({ weeks }: { weeks: WeekPoint[] }) {
  const W = 680;
  const H = 200;
  const padL = 30;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const liftHrs = weeks.map((w) => w.liftMin / 60);
  const runHrs = weeks.map((w) => w.runMin / 60);
  const maxHrs = Math.max(1, ...liftHrs, ...runHrs);
  const niceMax = Math.ceil(maxHrs);

  const [hover, setHover] = useState<number | null>(null);

  const n = weeks.length;
  // x positions: when sparse (1 point) center it.
  const x = (i: number) => (n === 1 ? padL + innerW / 2 : padL + (innerW * i) / (n - 1));
  const y = (h: number) => padT + innerH - (h / niceMax) * innerH;

  const liftPts = liftHrs.map((h, i) => `${x(i)},${y(h)}`);
  const runPts = runHrs.map((h, i) => `${x(i)},${y(h)}`);

  const liftCol = ramp(78); // lifting — high-signal green-ish
  const runCol = "#5aa9ff"; // running — neutral cool, kept distinct but desaturated

  const gridLines = [0, 0.5, 1].map((f) => niceMax * f);

  return (
    <div style={{ width: "100%", position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        {/* grid + y ticks */}
        {gridLines.map((g, i) => (
          <g key={i}>
            <line
              x1={padL}
              y1={y(g)}
              x2={W - padR}
              y2={y(g)}
              stroke={GRID}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text x={padL - 6} y={y(g) + 3} textAnchor="end" fontSize={9} fill={INK_DIM}>
              {g}h
            </text>
          </g>
        ))}

        {/* rest-week shaded marker: any week where both series are 0 */}
        {weeks.map((w, i) =>
          w.liftMin === 0 && w.runMin === 0 ? (
            <g key={`rest-${i}`}>
              <rect
                x={x(i) - 16}
                y={padT}
                width={32}
                height={innerH}
                rx={5}
                fill="#ffffff"
                opacity={0.04}
              />
              <text
                x={x(i)}
                y={padT + innerH / 2}
                textAnchor="middle"
                fontSize={8.5}
                fill={INK_DIM}
              >
                <tspan x={x(i)} dy={0}>
                  REST
                </tspan>
              </text>
              <circle cx={x(i)} cy={y(0)} r={3.5} fill={BG} stroke={INK_DIM} strokeWidth={1.5} />
            </g>
          ) : null,
        )}

        {/* area fills */}
        {n > 1 && (
          <>
            <polygon
              points={`${padL},${y(0)} ${liftPts.join(" ")} ${x(n - 1)},${y(0)}`}
              fill={liftCol}
              opacity={0.1}
            />
            <polyline points={liftPts.join(" ")} fill="none" stroke={liftCol} strokeWidth={2.25} />
            <polyline
              points={runPts.join(" ")}
              fill="none"
              stroke={runCol}
              strokeWidth={2.25}
              strokeDasharray="1 0"
            />
          </>
        )}

        {/* points + axis ticks */}
        {weeks.map((w, i) => {
          const active = hover === i;
          return (
            <g key={w.weekStartMs}>
              {/* lift point */}
              <circle
                cx={x(i)}
                cy={y(liftHrs[i])}
                r={active ? 4 : 2.6}
                fill={liftCol}
                stroke={BG}
                strokeWidth={1.5}
              />
              {/* run point */}
              <circle
                cx={x(i)}
                cy={y(runHrs[i])}
                r={active ? 4 : 2.6}
                fill={runCol}
                stroke={BG}
                strokeWidth={1.5}
              />
              {/* axis tick */}
              <text
                x={x(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={9}
                fill={active ? INK_MID : INK_DIM}
              >
                {w.tick}
              </text>
              {/* hit area */}
              <rect
                x={x(i) - (n === 1 ? innerW / 2 : innerW / n / 2)}
                y={0}
                width={n === 1 ? innerW : innerW / n}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover((h) => (h === i ? null : h))}
                style={{ cursor: "pointer" }}
              />
              {active && (
                <line
                  x1={x(i)}
                  y1={padT}
                  x2={x(i)}
                  y2={padT + innerH}
                  stroke={INK_DIM}
                  strokeWidth={1}
                />
              )}
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 6, paddingLeft: 30 }}>
        <LegendDot color={liftCol} label="Lifting" />
        <LegendDot color={runCol} label="Running" />
      </div>

      {/* tooltip-style label */}
      {hover !== null && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 8,
            background: "#000",
            border: `1px solid ${LINE}`,
            borderRadius: 8,
            padding: "8px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
            minWidth: 120,
          }}
        >
          <span style={{ fontSize: 10, color: INK_MID, fontWeight: 600 }}>
            {weeks[hover].range}
          </span>
          <Triplet color={liftCol} label="Lift" value={fmtHrsMin(weeks[hover].liftMin)} />
          <Triplet color={runCol} label="Run" value={fmtHrsMin(weeks[hover].runMin)} />
          {weeks[hover].liftMin === 0 && weeks[hover].runMin === 0 && (
            <span style={{ fontSize: 9.5, color: INK_DIM }}>Planned rest week</span>
          )}
        </div>
      )}
    </div>
  );
}

function fmtHrsMin(min: number): string {
  if (min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 9, height: 3, borderRadius: 2, background: color }} />
      <span style={{ fontSize: 10.5, color: INK_MID }}>{label}</span>
    </div>
  );
}

function Triplet({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 6, background: color }} />
      <span style={{ fontSize: 10, color: INK_DIM, width: 24 }}>{label}</span>
      <span style={{ fontSize: 11, color: INK, fontWeight: 600, marginLeft: "auto" }}>{value}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Mini trend sparkline (reused for Workouts / Running headers).       */
/* ------------------------------------------------------------------ */

function Trend({ values, signal }: { values: number[]; signal: number }) {
  const W = 220;
  const H = 48;
  const max = Math.max(1, ...values);
  const n = values.length;
  const x = (i: number) => (n === 1 ? W / 2 : (W * i) / (n - 1));
  const y = (v: number) => H - 4 - (v / max) * (H - 8);
  const col = ramp(signal);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <polygon points={`0,${H} ${pts.join(" ")} ${W},${H}`} fill={col} opacity={0.12} />
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={col}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={1.8} fill={col} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Steps daily bar chart with dashed goal line.                        */
/* ------------------------------------------------------------------ */

function StepsBars() {
  const W = 680;
  const H = 200;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(STEPS_GOAL * 1.2, ...STEP_DAYS.map((d) => d.steps));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const n = STEP_DAYS.length;
  const slot = innerW / n;
  const bw = slot * 0.52;

  const goalY = y(STEPS_GOAL);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      {/* baseline grid */}
      {[0, 0.5, 1].map((f, i) => {
        const v = max * f;
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y(v)}
              x2={W - padR}
              y2={y(v)}
              stroke={GRID}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill={INK_DIM}>
              {Math.round(v / 1000)}k
            </text>
          </g>
        );
      })}

      {STEP_DAYS.map((d, i) => {
        const cx = padL + slot * i + slot / 2;
        const top = y(d.steps);
        // map step attainment to ramp; cap signal at 100 for over
        const pct = Math.min(100, (d.steps / STEPS_GOAL) * 100);
        const over = d.state === "over";
        const col = over ? ramp(100) : ramp(pct);
        return (
          <g key={d.date}>
            <rect
              x={cx - bw / 2}
              y={top}
              width={bw}
              height={padT + innerH - top}
              rx={3}
              fill={col}
              opacity={d.state === "under" ? 0.55 : 1}
            />
            {/* over-goal cap glow marker */}
            {over && (
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={3}
                rx={1.5}
                fill="#ffffff"
                opacity={0.5}
              />
            )}
            <text
              x={cx}
              y={top - 5}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill={over ? INK : INK_MID}
            >
              {(d.steps / 1000).toFixed(1)}k
            </text>
            <text x={cx} y={H - 13} textAnchor="middle" fontSize={9.5} fill={INK_MID}>
              {d.dow}
            </text>
            <text x={cx} y={H - 3} textAnchor="middle" fontSize={8.5} fill={INK_DIM}>
              {d.date.replace("Jun ", "")}
            </text>
          </g>
        );
      })}

      {/* dashed goal line — the reference */}
      <line
        x1={padL}
        y1={goalY}
        x2={W - padR}
        y2={goalY}
        stroke={ramp(60)}
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <rect x={W - padR - 70} y={goalY - 16} width={70} height={13} rx={3} fill={BG} />
      <text
        x={W - padR - 3}
        y={goalY - 6}
        textAnchor="end"
        fontSize={9}
        fontWeight={600}
        fill={ramp(60)}
      >
        GOAL 10k
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Brand mark — Prog Strength "P".                                     */
/* ------------------------------------------------------------------ */

function Brand() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 8,
          background: `linear-gradient(135deg, ${ramp(15)}, ${ramp(85)})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 0 0 1px #ffffff14",
        }}
      >
        <span style={{ fontSize: 17, fontWeight: 800, color: "#0a0b0d", lineHeight: 1 }}>P</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: INK, letterSpacing: 0.3 }}>
          PROG STRENGTH
        </span>
        <span
          style={{ fontSize: 9.5, color: INK_DIM, letterSpacing: 1.5, textTransform: "uppercase" }}
        >
          Activity readout
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Session / Run cards.                                                */
/* ------------------------------------------------------------------ */

function SessionRow({
  name,
  isPR,
  when,
  duration,
  exercises,
  volume,
  note,
}: {
  name: string;
  isPR: boolean;
  when: string;
  duration: string;
  exercises: number;
  volume: string;
  note?: string;
}) {
  return (
    <div
      style={{
        background: PANEL_2,
        border: `1px solid ${LINE_SOFT}`,
        borderLeft: `2px solid ${isPR ? ramp(90) : LINE}`,
        borderRadius: 9,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        {isPR && (
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: ramp(95),
              background: "#ffffff0d",
              border: `1px solid ${ramp(90)}44`,
              borderRadius: 5,
              padding: "1px 6px",
              flexShrink: 0,
            }}
          >
            🏆 PR
          </span>
        )}
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: INK,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: 10.5, color: INK_DIM, marginLeft: "auto", flexShrink: 0 }}>
          {when}
        </span>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <MetaPair label="Dur" value={duration} />
        <MetaPair label="Exr" value={String(exercises)} />
        <MetaPair label="Vol" value={`${volume} lb`} />
      </div>
      {note && (
        <p
          style={{
            margin: 0,
            fontSize: 11,
            color: INK_MID,
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function MetaPair({ label, value }: { label: string; value: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5 }}>
      <span
        style={{ fontSize: 9.5, color: INK_DIM, textTransform: "uppercase", letterSpacing: 0.8 }}
      >
        {label}
      </span>
      <span style={{ fontSize: 11.5, color: INK, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function RunRow({
  name,
  when,
  distance,
  time,
  pace,
  hr,
}: {
  name: string;
  when: string;
  distance: string;
  time: string;
  pace: string;
  hr: string;
}) {
  return (
    <div
      style={{
        background: PANEL_2,
        border: `1px solid ${LINE_SOFT}`,
        borderRadius: 9,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
        <span
          style={{ width: 6, height: 6, borderRadius: 6, background: "#5aa9ff", flexShrink: 0 }}
        />
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: INK,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            minWidth: 0,
          }}
        >
          {name}
        </span>
        <span style={{ fontSize: 10.5, color: INK_DIM, marginLeft: "auto", flexShrink: 0 }}>
          {when}
        </span>
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <MetaPair label="Dist" value={distance} />
        <MetaPair label="Time" value={time} />
        <MetaPair label="Pace" value={pace} />
        <MetaPair label="HR" value={hr} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Week-group header chip.                                             */
/* ------------------------------------------------------------------ */

function GroupHead({ label, range, summary }: { label: string; range: string; summary: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, padding: "2px 2px 8px" }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{label}</span>
      <span style={{ fontSize: 10.5, color: INK_DIM }}>{range}</span>
      <span style={{ fontSize: 10.5, color: INK_MID, marginLeft: "auto" }}>{summary}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs.                                                               */
/* ------------------------------------------------------------------ */

function OverviewTab({ period }: { period: Period }) {
  const weeks = weeksForPeriod(period);

  // Readiness-style hero: derive a composite "training load" signal from the period.
  const totalLift = weeks.reduce((s, w) => s + w.liftMin, 0);
  const totalRun = weeks.reduce((s, w) => s + w.runMin, 0);
  const activeWeeks = weeks.filter((w) => w.liftMin + w.runMin > 0).length || 1;
  // target ~240 active min/week -> attainment %.
  const loadPct = Math.min(100, Math.round(((totalLift + totalRun) / activeWeeks / 240) * 100));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* hero ring row */}
      <Panel>
        <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Ring
            size={150}
            stroke={13}
            pct={loadPct}
            signal={loadPct}
            value={`${loadPct}%`}
            caption="Load"
          />
          <div
            style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 10 }}
          >
            <Label>Weekly readiness</Label>
            <p
              style={{ margin: 0, fontSize: 12.5, color: INK_MID, lineHeight: 1.5, maxWidth: 360 }}
            >
              {"Training load mapped to the readiness ramp — where you stand against a balanced "}
              {"lift + run week. Glance and go."}
            </p>
            <div style={{ display: "flex", gap: 18 }}>
              <Ring
                size={66}
                stroke={7}
                pct={STEPS_SUMMARY.pctOfGoal}
                signal={STEPS_SUMMARY.pctOfGoal}
                value={`${STEPS_SUMMARY.pctOfGoal}%`}
                caption="Steps"
              />
              <Ring
                size={66}
                stroke={7}
                pct={(WORKOUTS_SUMMARY.prs / 8) * 100}
                signal={(WORKOUTS_SUMMARY.prs / 8) * 100}
                value={String(WORKOUTS_SUMMARY.prs)}
                caption="PRs"
              />
              <Ring
                size={66}
                stroke={7}
                pct={Math.min(100, (totalRun / 60 / 4) * 100)}
                signal={Math.min(100, (totalRun / 60 / 4) * 100)}
                value={`${(totalRun / 60).toFixed(1)}`}
                caption="Run h"
              />
            </div>
          </div>
        </div>
      </Panel>

      {/* primary stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {OVERVIEW_STATS_PRIMARY.map((s) => (
          <StatCell key={s.key} label={s.label} value={s.value} sub={s.sub} signal={66} />
        ))}
      </div>

      {/* signature chart */}
      <Panel>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Label>Weekly activity · hours</Label>
          <span style={{ fontSize: 10.5, color: INK_DIM }}>
            {PERIODS.find((p) => p.id === period)?.label}
          </span>
        </div>
        <WeeklyChart weeks={weeks} />
      </Panel>

      {/* secondary stat row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {OVERVIEW_STATS_SECONDARY.map((s) => (
          <StatCell key={s.key} label={s.label} value={s.value} sub={s.sub} signal={66} />
        ))}
      </div>

      {/* steps summary */}
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Ring
            size={88}
            stroke={9}
            pct={STEPS_SUMMARY.pctOfGoal}
            signal={STEPS_SUMMARY.pctOfGoal}
            value={`${STEPS_SUMMARY.pctOfGoal}%`}
            caption="Goal"
          />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            <Label>Steps · avg daily</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
                {STEPS_SUMMARY.avgDaily.toLocaleString()}
              </span>
              <span style={{ fontSize: 12, color: INK_MID }}>
                / {STEPS_SUMMARY.goal.toLocaleString()} goal
              </span>
            </div>
            {/* linear track echoing the ring signal */}
            <div style={{ height: 7, borderRadius: 5, background: LINE, overflow: "hidden" }}>
              <div
                style={{
                  width: `${STEPS_SUMMARY.pctOfGoal}%`,
                  height: "100%",
                  background: ramp(STEPS_SUMMARY.pctOfGoal),
                }}
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function WorkoutsTab() {
  const trend = WEEKLY.slice(-6).map((w) => w.liftMin);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 240 }}>
            <StatCell label="Total time" value={WORKOUTS_SUMMARY.totalTime} signal={72} />
            <StatCell label="Sessions" value={String(WORKOUTS_SUMMARY.sessions)} signal={72} />
            <StatCell label="PRs" value={String(WORKOUTS_SUMMARY.prs)} signal={92} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Label>Lift minutes · 6 wk</Label>
            <Trend values={trend} signal={78} />
          </div>
        </div>
      </Panel>

      {WORKOUT_WEEKS.map((wk) => (
        <div key={wk.id} style={{ display: "flex", flexDirection: "column" }}>
          <GroupHead
            label={wk.label}
            range={wk.range}
            summary={`${wk.totalTime} · ${wk.activities} act`}
          />
          {wk.sessions.length === 0 ? (
            <div
              style={{
                background: PANEL,
                border: `1px dashed ${LINE}`,
                borderRadius: 10,
                padding: "16px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span style={{ fontSize: 18 }}>🌙</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: INK }}>
                  Rest week — by design
                </span>
                <span style={{ fontSize: 11, color: INK_MID }}>
                  {"No sessions logged. A planned deload to bank recovery."}
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {wk.sessions.map((s) => (
                <SessionRow key={s.id} {...s} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RunningTab() {
  const trend = WEEKLY.slice(-6).map((w) => w.runMin);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {RUNNING_KPIS.map((k) => (
          <div
            key={k.key}
            style={{
              background: PANEL_2,
              border: `1px solid ${LINE_SOFT}`,
              borderRadius: 10,
              padding: "10px 11px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <Label>{k.label}</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span style={{ fontSize: 19, fontWeight: 700, color: INK, letterSpacing: -0.5 }}>
                {k.value}
              </span>
              {k.sub && <span style={{ fontSize: 10.5, color: INK_MID }}>{k.sub}</span>}
            </div>
            {/* delta tile color logic obviously extends to negative/null */}
            {k.deltaPct !== undefined && k.deltaPct !== null ? (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  color: k.deltaPct >= 0 ? ramp(90) : ramp(8),
                }}
              >
                {fmtDelta(k.deltaPct)}
                <span style={{ color: INK_DIM, fontWeight: 500 }}>{" vs prior"}</span>
              </span>
            ) : (
              <span style={{ fontSize: 10.5, color: INK_DIM }}>{"—"}</span>
            )}
          </div>
        ))}
      </div>

      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 10, flex: 1, minWidth: 240 }}>
            <StatCell label="Distance" value={RUNNING_SUMMARY.totalDistance} sub="mi" signal={64} />
            <StatCell label="Time" value={RUNNING_SUMMARY.totalTime} signal={64} />
            <StatCell label="Runs" value={String(RUNNING_SUMMARY.runs)} signal={64} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Label>Run minutes · 6 wk</Label>
            <Trend values={trend} signal={58} />
          </div>
        </div>
      </Panel>

      {RUN_MONTHS.map((m) => (
        <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{m.label}</span>
            <span style={{ fontSize: 10.5, color: INK_MID, marginLeft: "auto" }}>{m.summary}</span>
          </div>
          {m.weeks.map((w) => (
            <div key={w.id} style={{ display: "flex", flexDirection: "column" }}>
              <GroupHead label={w.label} range={w.range} summary={w.summary} />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {w.runs.map((r) => (
                  <RunRow key={r.id} {...r} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function StepsTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {STEPS_KPIS.map((k) => (
          <StatCell
            key={k.key}
            label={k.label}
            value={k.value}
            sub={k.sub}
            signal={k.key === "goal" ? STEPS_SUMMARY.pctOfGoal : 66}
          />
        ))}
      </div>

      <Panel>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Label>Daily steps · last 7</Label>
          <span style={{ fontSize: 10.5, color: INK_DIM }}>
            {"Bars read against the dashed 10k goal"}
          </span>
        </div>
        <StepsBars />
      </Panel>

      {/* editable-looking log table */}
      <Panel style={{ padding: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 14px",
            borderBottom: `1px solid ${LINE}`,
          }}
        >
          <Label>Step log</Label>
          <button
            type="button"
            style={{
              marginLeft: "auto",
              fontSize: 11,
              fontWeight: 600,
              color: BG,
              background: ramp(75),
              border: "none",
              borderRadius: 7,
              padding: "5px 10px",
              cursor: "pointer",
            }}
          >
            + Log steps
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 76px",
              padding: "7px 14px",
              borderBottom: `1px solid ${LINE_SOFT}`,
            }}
          >
            <Label>Date</Label>
            <Label>Steps</Label>
            <span />
          </div>
          {STEP_LOG.map((row) => {
            const pct = Math.min(100, (row.steps / STEPS_GOAL) * 100);
            return (
              <div
                key={row.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 76px",
                  alignItems: "center",
                  padding: "9px 14px",
                  borderBottom: `1px solid ${LINE_SOFT}`,
                }}
              >
                <span style={{ fontSize: 12, color: INK_MID }}>{row.date}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: 5, background: ramp(pct) }} />
                  <span style={{ fontSize: 12.5, color: INK, fontWeight: 600 }}>
                    {row.steps.toLocaleString()}
                  </span>
                </span>
                <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                  <IconBtn label="Edit">✎</IconBtn>
                  <IconBtn label="Delete">🗑</IconBtn>
                </span>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function IconBtn({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: `1px solid ${LINE}`,
        background: PANEL_2,
        color: INK_MID,
        fontSize: 11,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Root.                                                               */
/* ------------------------------------------------------------------ */

export function WhoopVariant(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div
      style={{
        minHeight: 820,
        background: BG,
        color: INK,
        fontFamily: FONT,
        padding: "18px 20px 40px",
      }}
    >
      <div
        style={{
          maxWidth: 760,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* header chrome */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <Brand />
          {/* period pills */}
          <div
            style={{
              display: "inline-flex",
              background: PANEL,
              border: `1px solid ${LINE}`,
              borderRadius: 9,
              padding: 3,
              gap: 2,
            }}
          >
            {PERIODS.map((p) => {
              const on = p.id === period;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    color: on ? BG : INK_MID,
                    background: on ? ramp(70) : "transparent",
                    border: "none",
                    borderRadius: 7,
                    padding: "5px 11px",
                    cursor: "pointer",
                  }}
                >
                  {p.short}
                </button>
              );
            })}
          </div>
        </header>

        {/* tab bar */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            borderBottom: `1px solid ${LINE}`,
            paddingBottom: 0,
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
                  position: "relative",
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 600,
                  color: on ? INK : INK_DIM,
                  background: "transparent",
                  border: "none",
                  padding: "8px 12px 10px",
                  cursor: "pointer",
                }}
              >
                {t.label}
                {on && (
                  <span
                    style={{
                      position: "absolute",
                      left: 8,
                      right: 8,
                      bottom: -1,
                      height: 2,
                      borderRadius: 2,
                      background: ramp(70),
                    }}
                  />
                )}
              </button>
            );
          })}
          {activeTab?.action && (
            <button
              type="button"
              style={{
                marginLeft: "auto",
                fontSize: 11,
                fontWeight: 600,
                color: INK,
                background: PANEL_2,
                border: `1px solid ${LINE}`,
                borderRadius: 7,
                padding: "5px 11px",
                cursor: "pointer",
              }}
            >
              {activeTab.action}
            </button>
          )}
        </nav>

        {/* content */}
        {tab === "overview" && <OverviewTab period={period} />}
        {tab === "workouts" && <WorkoutsTab />}
        {tab === "running" && <RunningTab />}
        {tab === "steps" && <StepsTab />}
      </div>
    </div>
  );
}
