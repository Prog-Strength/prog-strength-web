"use client";

import { useState } from "react";
import {
  PERIODS,
  TABS,
  OVERVIEW_STATS_PRIMARY,
  OVERVIEW_STATS_SECONDARY,
  STEPS_SUMMARY,
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
  type StatTile,
  type WeekPoint,
} from "../_fixtures";

// ---- terminal palette -----------------------------------------------------
const BG = "#050505";
const BG_ALT = "#0b0b0b";
const HAIR = "rgba(255,176,0,0.15)";
const HAIR_HOT = "rgba(255,176,0,0.30)";
const DIM = "#7a6a3a"; // dim amber-gray, default text
const FG = "#c9b87a"; // base amber-gray text
const AMBER = "#ffb000"; // primary phosphor / hit-PR
const GREEN = "#33ff66"; // up / running
const RED = "#ff5f56"; // down
const WHITE = "#e8e2cc";

const MONO = "var(--dx-font-plex-mono), ui-monospace, monospace";

// delta color logic — extends to negative (down) and null (hidden)
function deltaColor(pct: number): string {
  if (pct > 0) return GREEN;
  if (pct < 0) return RED;
  return DIM;
}

// generic terminal cell
const cell: React.CSSProperties = {
  padding: "3px 10px",
  fontSize: 12,
  lineHeight: "18px",
  whiteSpace: "nowrap",
};

export function BrutalistVariant(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  const periodMeta = PERIODS.find((p) => p.id === period) ?? PERIODS[1];

  return (
    <div
      style={{
        minHeight: 820,
        background: BG,
        color: FG,
        fontFamily: MONO,
        fontVariantNumeric: "tabular-nums",
        fontSize: 12,
        letterSpacing: "0.01em",
      }}
    >
      <StatusBar period={periodMeta.short} />
      <PeriodBar period={period} setPeriod={setPeriod} />
      <TabBar tab={tab} setTab={setTab} />

      <div style={{ borderTop: `1px solid ${HAIR}` }}>
        {tab === "overview" && <OverviewTab period={period} rangeLabel={periodMeta.label} />}
        {tab === "workouts" && <WorkoutsTab />}
        {tab === "running" && <RunningTab />}
        {tab === "steps" && <StepsTab />}
      </div>

      <FootBar tab={tab} period={periodMeta.short} />
    </div>
  );
}

// ===========================================================================
// CHROME
// ===========================================================================

function StatusBar({ period }: { period: string }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        borderBottom: `1px solid ${HAIR_HOT}`,
        background: BG,
        height: 30,
      }}
    >
      {/* P brand mark */}
      <div
        style={{
          width: 30,
          height: 30,
          display: "grid",
          placeItems: "center",
          borderRight: `1px solid ${HAIR_HOT}`,
          color: BG,
          background: AMBER,
          fontWeight: 700,
          fontSize: 16,
        }}
      >
        P
      </div>
      <div style={{ ...cell, color: AMBER, fontWeight: 700, letterSpacing: "0.12em" }}>
        PROG STRENGTH
      </div>
      <div style={{ ...cell, color: DIM, borderLeft: `1px solid ${HAIR}` }}>ACTIVITY LEDGER</div>
      <div style={{ flex: 1 }} />
      <div style={{ ...cell, color: GREEN }}>● LIVE</div>
      <div style={{ ...cell, color: DIM, borderLeft: `1px solid ${HAIR}` }}>PERIOD {period}</div>
      <div
        style={{
          ...cell,
          color: FG,
          borderLeft: `1px solid ${HAIR}`,
          borderRight: `1px solid ${HAIR}`,
        }}
      >
        2026-06-18 09:41:07Z
      </div>
    </div>
  );
}

function PeriodBar({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      <div style={{ ...cell, color: DIM }}>WINDOW</div>
      {PERIODS.map((p) => {
        const on = p.id === period;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            style={{
              ...cell,
              cursor: "pointer",
              border: "none",
              borderLeft: `1px solid ${HAIR}`,
              borderRadius: 0,
              background: on ? AMBER : "transparent",
              color: on ? BG : DIM,
              fontWeight: on ? 700 : 400,
              fontFamily: MONO,
            }}
          >
            {`[${p.short.replace("D", "")}]`}
          </button>
        );
      })}
      <div style={{ flex: 1, borderLeft: `1px solid ${HAIR}` }} />
    </div>
  );
}

function TabBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${HAIR}` }}>
      {TABS.map((t) => {
        const on = t.id === tab;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            style={{
              ...cell,
              cursor: "pointer",
              border: "none",
              borderRight: `1px solid ${HAIR}`,
              borderRadius: 0,
              background: on ? BG_ALT : "transparent",
              color: on ? AMBER : DIM,
              fontWeight: on ? 700 : 400,
              fontFamily: MONO,
              letterSpacing: "0.08em",
              borderBottom: on ? `2px solid ${AMBER}` : "2px solid transparent",
            }}
          >
            {`[ ${t.label.toUpperCase()} ]`}
          </button>
        );
      })}
      <div style={{ flex: 1, borderBottom: "2px solid transparent" }} />
    </div>
  );
}

function FootBar({ tab, period }: { tab: TabId; period: string }): React.JSX.Element {
  const action = TABS.find((t) => t.id === tab)?.action;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderTop: `1px solid ${HAIR_HOT}`,
        marginTop: 1,
      }}
    >
      <div style={{ ...cell, color: BG, background: AMBER, fontWeight: 700 }}>F1 HELP</div>
      <div style={{ ...cell, color: DIM, borderRight: `1px solid ${HAIR}` }}>
        VIEW {tab.toUpperCase()}
      </div>
      <div style={{ ...cell, color: DIM, borderRight: `1px solid ${HAIR}` }}>WIN {period}</div>
      <div style={{ flex: 1 }} />
      {action && (
        <div style={{ ...cell, color: GREEN, borderLeft: `1px solid ${HAIR}` }}>
          {`[ENTER] ${action.toUpperCase()}`}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// REUSABLE LEDGER PRIMITIVES
// ===========================================================================

function SectionRule({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 10px",
        background: BG_ALT,
        borderBottom: `1px solid ${HAIR}`,
        borderTop: `1px solid ${HAIR}`,
        color: AMBER,
        fontWeight: 700,
        letterSpacing: "0.14em",
        fontSize: 11,
      }}
    >
      <span>{"//"}</span>
      <span>{children}</span>
      <span style={{ flex: 1, overflow: "hidden", color: DIM, whiteSpace: "nowrap" }}>
        {" " + "═".repeat(200)}
      </span>
    </div>
  );
}

function StatRow({ stats }: { stats: StatTile[] }): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${stats.length}, 1fr)`,
        borderBottom: `1px solid ${HAIR}`,
      }}
    >
      {stats.map((s, i) => (
        <div
          key={s.key}
          style={{
            padding: "8px 12px",
            borderLeft: i === 0 ? "none" : `1px solid ${HAIR}`,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ color: DIM, fontSize: 11, letterSpacing: "0.06em" }}>
            {s.label.toUpperCase()}
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span style={{ color: WHITE, fontSize: 14, fontWeight: 700 }}>{s.value}</span>
            {s.sub && <span style={{ color: DIM, fontSize: 11 }}>{s.sub}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}

// horizontal block-character bar (single series, terminal style)
function BlockBar({
  value,
  max,
  color,
  width = 22,
}: {
  value: number;
  max: number;
  color: string;
  width?: number;
}): React.JSX.Element {
  const filled = max <= 0 ? 0 : Math.round((value / max) * width);
  return (
    <span style={{ whiteSpace: "pre", letterSpacing: "-0.5px" }}>
      <span style={{ color }}>{"▮".repeat(filled)}</span>
      <span style={{ color: HAIR }}>{"▏".repeat(Math.max(0, width - filled))}</span>
    </span>
  );
}

// ===========================================================================
// OVERVIEW
// ===========================================================================

function OverviewTab({
  period,
  rangeLabel,
}: {
  period: Period;
  rangeLabel: string;
}): React.JSX.Element {
  const weeks = weeksForPeriod(period);
  return (
    <div>
      <SectionRule>OVERVIEW · {rangeLabel.toUpperCase()}</SectionRule>
      <StatRow stats={OVERVIEW_STATS_PRIMARY} />

      <SectionRule>WEEKLY ACTIVITY · LIFT/RUN HRS</SectionRule>
      <WeeklyDualChart weeks={weeks} />

      <SectionRule>SECONDARY</SectionRule>
      <StatRow stats={OVERVIEW_STATS_SECONDARY} />

      <SectionRule>STEPS SUMMARY</SectionRule>
      <StepsSummaryBlock />
    </div>
  );
}

function WeeklyDualChart({ weeks }: { weeks: WeekPoint[] }): React.JSX.Element {
  // hours
  const maxMin = Math.max(60, ...weeks.flatMap((w) => [w.liftMin, w.runMin]));
  const W = 760;
  const H = 150;
  const padL = 44;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = weeks.length;
  const x = (i: number) => (n === 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const y = (min: number) => padT + plotH - (min / maxMin) * plotH;

  const liftPts = weeks.map((w, i) => `${x(i)},${y(w.liftMin)}`).join(" ");
  const runPts = weeks.map((w, i) => `${x(i)},${y(w.runMin)}`).join(" ");

  // gridlines at hour marks
  const maxHr = Math.ceil(maxMin / 60);
  const hrLines: number[] = [];
  for (let h = 0; h <= maxHr; h++) hrLines.push(h);

  return (
    <div style={{ padding: "10px 10px 4px", borderBottom: `1px solid ${HAIR}` }}>
      {/* legend / readout strip */}
      <div style={{ display: "flex", gap: 18, marginBottom: 6, fontSize: 11 }}>
        <span style={{ color: AMBER }}>{"━ LIFT"}</span>
        <span style={{ color: GREEN }}>{"┄ RUN"}</span>
        <span style={{ color: DIM }}>
          {"PEAK " + (maxMin / 60).toFixed(1) + "h"} · {n} WK
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", height: "auto", maxWidth: W }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* hour gridlines */}
        {hrLines.map((h) => {
          const yy = y(h * 60);
          return (
            <g key={h}>
              <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke={HAIR} strokeWidth={1} />
              <text
                x={padL - 6}
                y={yy + 3}
                textAnchor="end"
                fontSize={9}
                fill={DIM}
                fontFamily={MONO}
              >
                {h}h
              </text>
            </g>
          );
        })}

        {/* rest-week markers: vertical hairline + R glyph where both series 0 */}
        {weeks.map((w, i) =>
          w.liftMin === 0 && w.runMin === 0 ? (
            <g key={`rest-${w.weekStartMs}`}>
              <line
                x1={x(i)}
                y1={padT}
                x2={x(i)}
                y2={padT + plotH}
                stroke={RED}
                strokeWidth={1}
                strokeDasharray="2 3"
                opacity={0.5}
              />
              <text
                x={x(i)}
                y={padT + 10}
                textAnchor="middle"
                fontSize={8}
                fill={RED}
                fontFamily={MONO}
              >
                REST
              </text>
            </g>
          ) : null,
        )}

        {/* RUN dashed line (under) */}
        {n > 1 && (
          <polyline
            points={runPts}
            fill="none"
            stroke={GREEN}
            strokeWidth={1.25}
            strokeDasharray="3 3"
            opacity={0.9}
          />
        )}
        {/* LIFT solid line (over) */}
        {n > 1 && <polyline points={liftPts} fill="none" stroke={AMBER} strokeWidth={1.5} />}

        {/* nodes — squares (lift) and crosses (run); zero-weeks read as baseline dots */}
        {weeks.map((w, i) => (
          <g key={`node-${w.weekStartMs}`}>
            {/* run cross */}
            <rect
              x={x(i) - 2}
              y={y(w.runMin) - 2}
              width={4}
              height={4}
              fill={BG}
              stroke={GREEN}
              strokeWidth={1}
            />
            {/* lift square */}
            <rect
              x={x(i) - 2.5}
              y={y(w.liftMin) - 2.5}
              width={5}
              height={5}
              fill={w.liftMin === 0 ? BG : AMBER}
              stroke={AMBER}
              strokeWidth={1}
            />
            {/* x tick */}
            <text
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              fontSize={8.5}
              fill={DIM}
              fontFamily={MONO}
            >
              {w.tick}
            </text>
          </g>
        ))}
      </svg>

      {/* tabular readout — one row per week so figures align */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 4,
          fontSize: 11,
          tableLayout: "fixed",
        }}
      >
        <thead>
          <tr style={{ color: DIM, textAlign: "right" }}>
            <th style={{ textAlign: "left", padding: "2px 6px", fontWeight: 400 }}>RANGE</th>
            <th style={{ padding: "2px 6px", fontWeight: 400 }}>LIFT</th>
            <th style={{ padding: "2px 6px", fontWeight: 400 }}>RUN</th>
            <th style={{ padding: "2px 6px", fontWeight: 400 }}>BAR</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w) => {
            const rest = w.liftMin === 0 && w.runMin === 0;
            return (
              <tr key={w.weekStartMs} style={{ borderTop: `1px solid ${HAIR}` }}>
                <td style={{ textAlign: "left", padding: "2px 6px", color: rest ? RED : FG }}>
                  {w.range}
                </td>
                <td style={{ textAlign: "right", padding: "2px 6px", color: AMBER }}>
                  {(w.liftMin / 60).toFixed(1)}h
                </td>
                <td style={{ textAlign: "right", padding: "2px 6px", color: GREEN }}>
                  {(w.runMin / 60).toFixed(1)}h
                </td>
                <td style={{ textAlign: "right", padding: "2px 6px" }}>
                  {rest ? (
                    <span style={{ color: RED, letterSpacing: "0.1em" }}>-- REST --</span>
                  ) : (
                    <BlockBar
                      value={w.liftMin + w.runMin}
                      max={maxMin * 1.4}
                      color={AMBER}
                      width={16}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StepsSummaryBlock(): React.JSX.Element {
  return (
    <div style={{ padding: "10px 12px", borderBottom: `1px solid ${HAIR}`, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 28, alignItems: "baseline", flexWrap: "wrap" }}>
        <span>
          <span style={{ color: DIM }}>AVG DAILY </span>
          <span style={{ color: WHITE, fontWeight: 700 }}>
            {STEPS_SUMMARY.avgDaily.toLocaleString()}
          </span>
        </span>
        <span>
          <span style={{ color: DIM }}>GOAL </span>
          <span style={{ color: FG }}>{STEPS_SUMMARY.goal.toLocaleString()}</span>
        </span>
        <span>
          <span style={{ color: DIM }}>{"OF GOAL "}</span>
          <span style={{ color: STEPS_SUMMARY.pctOfGoal >= 100 ? GREEN : AMBER, fontWeight: 700 }}>
            {STEPS_SUMMARY.pctOfGoal}%
          </span>
        </span>
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
        <BlockBar value={STEPS_SUMMARY.pctOfGoal} max={100} color={AMBER} width={40} />
        <span style={{ color: DIM, fontSize: 11 }}>{"|"} GOAL@100</span>
      </div>
    </div>
  );
}

// ===========================================================================
// WORKOUTS
// ===========================================================================

// small trend chart from weekly lift hours
function TrendStrip({
  values,
  color,
  label,
}: {
  values: number[];
  color: string;
  label: string;
}): React.JSX.Element {
  const max = Math.max(1, ...values);
  const W = 760;
  const H = 60;
  const padL = 8;
  const padR = 8;
  const padB = 4;
  const padT = 6;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = values.length;
  const bw = plotW / n;
  return (
    <div style={{ padding: "8px 10px", borderBottom: `1px solid ${HAIR}` }}>
      <div style={{ color: DIM, fontSize: 11, marginBottom: 4 }}>{label}</div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", height: "auto", maxWidth: W }}
        preserveAspectRatio="none"
      >
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke={HAIR} />
        {values.map((v, i) => {
          const h = (v / max) * plotH;
          const zero = v === 0;
          return (
            <rect
              key={i}
              x={padL + i * bw + 1}
              y={padT + plotH - h}
              width={Math.max(1, bw - 3)}
              height={zero ? 1 : h}
              fill={zero ? RED : color}
              opacity={zero ? 0.5 : 1}
            />
          );
        })}
      </svg>
    </div>
  );
}

function WorkoutsTab(): React.JSX.Element {
  const trend = WORKOUT_WEEKS.map((w) => {
    // parse "1h 30m" → minutes
    const m = /(?:(\d+)h)?\s*(?:(\d+)m)?/.exec(w.totalTime);
    const hh = m && m[1] ? parseInt(m[1], 10) : 0;
    const mm = m && m[2] ? parseInt(m[2], 10) : 0;
    return hh * 60 + mm;
  });
  return (
    <div>
      <SectionRule>WORKOUTS · SUMMARY</SectionRule>
      <div style={{ display: "flex", borderBottom: `1px solid ${HAIR}` }}>
        <KV label="TOTAL TIME" value={WORKOUTS_SUMMARY.totalTime} color={WHITE} />
        <KV label="SESSIONS" value={String(WORKOUTS_SUMMARY.sessions)} color={WHITE} />
        <KV label="PRS" value={String(WORKOUTS_SUMMARY.prs)} color={AMBER} />
      </div>

      <SectionRule>WEEKLY TIME TREND</SectionRule>
      <TrendStrip values={trend} color={AMBER} label="MIN / WEEK · REST WEEK FLAGGED RED" />

      <SectionRule>SESSION LEDGER</SectionRule>
      {WORKOUT_WEEKS.map((wk) => (
        <div key={wk.id}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 12,
              padding: "5px 10px",
              background: BG_ALT,
              borderBottom: `1px solid ${HAIR}`,
              fontSize: 11,
            }}
          >
            <span style={{ color: FG, fontWeight: 700 }}>{wk.label.toUpperCase()}</span>
            <span style={{ color: DIM }}>{wk.range}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: DIM }}>ACT {wk.activities}</span>
            <span style={{ color: FG }}>{wk.totalTime}</span>
          </div>

          {wk.sessions.length === 0 ? (
            <div
              style={{
                padding: "8px 10px",
                borderBottom: `1px solid ${HAIR}`,
                color: RED,
                letterSpacing: "0.2em",
                textAlign: "center",
                fontSize: 12,
              }}
            >
              {"———————————  -- REST --  DELOAD / RECOVERY  ———————————"}
            </div>
          ) : (
            wk.sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  padding: "6px 10px",
                  borderBottom: `1px solid ${HAIR}`,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  columnGap: 12,
                  rowGap: 2,
                }}
              >
                <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: 8 }}>
                  {s.isPR ? (
                    <span
                      style={{
                        color: BG,
                        background: AMBER,
                        fontWeight: 700,
                        fontSize: 10,
                        padding: "0 4px",
                      }}
                    >
                      PR
                    </span>
                  ) : (
                    <span style={{ color: DIM, fontSize: 10, padding: "0 4px" }}>--</span>
                  )}
                  <span
                    style={{
                      color: WHITE,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                  </span>
                </div>
                <div style={{ textAlign: "right", color: DIM, fontSize: 11 }}>{s.when}</div>

                <div style={{ color: DIM, fontSize: 11, display: "flex", gap: 14 }}>
                  <span>
                    <span style={{ color: DIM }}>DUR </span>
                    <span style={{ color: FG }}>{s.duration}</span>
                  </span>
                  <span>
                    <span style={{ color: DIM }}>EX </span>
                    <span style={{ color: FG }}>{s.exercises}</span>
                  </span>
                  <span>
                    <span style={{ color: DIM }}>VOL </span>
                    <span style={{ color: FG }}>{s.volume} lb</span>
                  </span>
                </div>
                {s.note && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      color: DIM,
                      fontSize: 11,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {"› "}
                    {s.note}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ))}
    </div>
  );
}

function KV({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        padding: "8px 12px",
        borderLeft: `1px solid ${HAIR}`,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ color: DIM, fontSize: 11 }}>{label}</span>
      <span style={{ color, fontSize: 14, fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ===========================================================================
// RUNNING
// ===========================================================================

function RunningTab(): React.JSX.Element {
  // trend from run cards distance
  const runValues: number[] = [];
  RUN_MONTHS.forEach((m) =>
    m.weeks.forEach((w) => w.runs.forEach((r) => runValues.push(parseFloat(r.distance) || 0))),
  );
  return (
    <div>
      <SectionRule>RUNNING · KPIS</SectionRule>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        {RUNNING_KPIS.map((k, i) => (
          <div
            key={k.key}
            style={{
              padding: "8px 12px",
              borderLeft: i === 0 ? "none" : `1px solid ${HAIR}`,
              display: "flex",
              flexDirection: "column",
              gap: 2,
            }}
          >
            <span style={{ color: DIM, fontSize: 11 }}>{k.label.toUpperCase()}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
              <span style={{ color: WHITE, fontSize: 14, fontWeight: 700 }}>{k.value}</span>
              {k.sub && <span style={{ color: DIM, fontSize: 11 }}>{k.sub}</span>}
            </span>
            {/* delta: positive shown colored; logic extends to neg/null */}
            {k.deltaPct === null || k.deltaPct === undefined ? null : (
              <span style={{ color: deltaColor(k.deltaPct), fontSize: 11, fontWeight: 700 }}>
                {fmtDelta(k.deltaPct)} {k.deltaPct >= 0 ? "▲" : "▼"} WoW
              </span>
            )}
          </div>
        ))}
      </div>

      <SectionRule>RUNNING · SUMMARY</SectionRule>
      <div style={{ display: "flex", borderBottom: `1px solid ${HAIR}` }}>
        <KV label="DISTANCE" value={`${RUNNING_SUMMARY.totalDistance} mi`} color={GREEN} />
        <KV label="TOTAL TIME" value={RUNNING_SUMMARY.totalTime} color={WHITE} />
        <KV label="RUNS" value={String(RUNNING_SUMMARY.runs)} color={WHITE} />
      </div>

      <SectionRule>DISTANCE TREND</SectionRule>
      <TrendStrip values={runValues} color={GREEN} label="MI / RUN" />

      <SectionRule>RUN LEDGER</SectionRule>
      {RUN_MONTHS.map((m) => (
        <div key={m.id}>
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: "5px 10px",
              background: BG_ALT,
              borderBottom: `1px solid ${HAIR}`,
              fontSize: 11,
            }}
          >
            <span style={{ color: AMBER, fontWeight: 700 }}>{m.label.toUpperCase()}</span>
            <span style={{ flex: 1 }} />
            <span style={{ color: DIM }}>{m.summary}</span>
          </div>
          {m.weeks.map((w) => (
            <div key={w.id}>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "4px 10px 4px 18px",
                  borderBottom: `1px solid ${HAIR}`,
                  fontSize: 11,
                }}
              >
                <span style={{ color: FG, fontWeight: 700 }}>{w.label.toUpperCase()}</span>
                <span style={{ color: DIM }}>{w.range}</span>
                <span style={{ flex: 1 }} />
                <span style={{ color: DIM }}>{w.summary}</span>
              </div>
              {/* run rows as a fixed-column table for alignment */}
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 11,
                }}
              >
                <tbody>
                  {w.runs.map((r) => (
                    <tr key={r.id} style={{ borderBottom: `1px solid ${HAIR}` }}>
                      <td
                        style={{
                          padding: "5px 8px 5px 18px",
                          color: WHITE,
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                      </td>
                      <td style={{ padding: "5px 8px", color: DIM, whiteSpace: "nowrap" }}>
                        {r.when}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: GREEN,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.distance}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: FG,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.time}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: FG,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.pace}
                      </td>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: AMBER,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.hr}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ===========================================================================
// STEPS
// ===========================================================================

function StepsTab(): React.JSX.Element {
  const maxSteps = Math.max(STEPS_GOAL, ...STEP_DAYS.map((d) => d.steps));
  const W = 760;
  const H = 170;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const n = STEP_DAYS.length;
  const bw = plotW / n;
  const yFor = (v: number) => padT + plotH - (v / maxSteps) * plotH;
  const goalY = yFor(STEPS_GOAL);

  const stateColor = (st: string) => (st === "over" ? GREEN : st === "at" ? AMBER : RED);

  return (
    <div>
      <SectionRule>STEPS · KPIS</SectionRule>
      <StatRow stats={STEPS_KPIS} />

      <SectionRule>DAILY STEPS · GOAL {STEPS_GOAL.toLocaleString()}</SectionRule>
      <div style={{ padding: "10px 10px 4px", borderBottom: `1px solid ${HAIR}` }}>
        <div style={{ display: "flex", gap: 18, marginBottom: 6, fontSize: 11 }}>
          <span style={{ color: GREEN }}>{"▮ OVER"}</span>
          <span style={{ color: RED }}>{"▮ UNDER"}</span>
          <span style={{ color: AMBER }}>{"▮ AT"}</span>
          <span style={{ color: DIM }}>{"┄ GOAL LINE"}</span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: "block", height: "auto", maxWidth: W }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* y gridlines at 5k steps */}
          {[0, 5000, 10000].map((g) =>
            g <= maxSteps ? (
              <g key={g}>
                <line x1={padL} y1={yFor(g)} x2={W - padR} y2={yFor(g)} stroke={HAIR} />
                <text
                  x={padL - 6}
                  y={yFor(g) + 3}
                  textAnchor="end"
                  fontSize={9}
                  fill={DIM}
                  fontFamily={MONO}
                >
                  {g / 1000}k
                </text>
              </g>
            ) : null,
          )}

          {/* bars */}
          {STEP_DAYS.map((d, i) => {
            const h = (d.steps / maxSteps) * plotH;
            const c = stateColor(d.state);
            return (
              <g key={d.date}>
                <rect
                  x={padL + i * bw + bw * 0.18}
                  y={padT + plotH - h}
                  width={bw * 0.64}
                  height={h}
                  fill={c}
                  opacity={d.state === "under" ? 0.85 : 1}
                />
                <text
                  x={padL + i * bw + bw / 2}
                  y={padT + plotH - h - 4}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={c}
                  fontFamily={MONO}
                >
                  {(d.steps / 1000).toFixed(1)}
                </text>
                <text
                  x={padL + i * bw + bw / 2}
                  y={H - 13}
                  textAnchor="middle"
                  fontSize={8.5}
                  fill={DIM}
                  fontFamily={MONO}
                >
                  {d.dow}
                </text>
                <text
                  x={padL + i * bw + bw / 2}
                  y={H - 3}
                  textAnchor="middle"
                  fontSize={8}
                  fill={DIM}
                  fontFamily={MONO}
                >
                  {d.date.replace("Jun ", "")}
                </text>
              </g>
            );
          })}

          {/* DASHED GOAL LINE */}
          <line
            x1={padL}
            y1={goalY}
            x2={W - padR}
            y2={goalY}
            stroke={AMBER}
            strokeWidth={1.25}
            strokeDasharray="5 4"
          />
          <text
            x={W - padR}
            y={goalY - 4}
            textAnchor="end"
            fontSize={9}
            fill={AMBER}
            fontFamily={MONO}
          >
            GOAL {STEPS_GOAL.toLocaleString()}
          </text>
        </svg>
      </div>

      <SectionRule>STEP LOG · EDITABLE</SectionRule>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
        }}
      >
        <thead>
          <tr style={{ color: DIM, background: BG_ALT }}>
            <th style={{ textAlign: "left", padding: "5px 12px", fontWeight: 400 }}>DATE</th>
            <th style={{ textAlign: "right", padding: "5px 12px", fontWeight: 400 }}>STEPS</th>
            <th style={{ textAlign: "right", padding: "5px 12px", fontWeight: 400 }}>Δ GOAL</th>
            <th style={{ textAlign: "right", padding: "5px 12px", fontWeight: 400 }}>EDIT</th>
          </tr>
        </thead>
        <tbody>
          {STEP_LOG.map((row) => {
            const diff = row.steps - STEPS_GOAL;
            const c = diff > 0 ? GREEN : diff < 0 ? RED : AMBER;
            return (
              <tr key={row.id} style={{ borderTop: `1px solid ${HAIR}` }}>
                <td style={{ padding: "5px 12px", color: FG }}>{row.date}</td>
                <td style={{ padding: "5px 12px", textAlign: "right", color: WHITE }}>
                  {row.steps.toLocaleString()}
                </td>
                <td style={{ padding: "5px 12px", textAlign: "right", color: c }}>
                  {diff >= 0 ? "+" : "−"}
                  {Math.abs(diff).toLocaleString()}
                </td>
                <td style={{ padding: "5px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    style={{
                      cursor: "pointer",
                      border: `1px solid ${HAIR_HOT}`,
                      borderRadius: 0,
                      background: "transparent",
                      color: AMBER,
                      fontFamily: MONO,
                      fontSize: 10,
                      padding: "1px 6px",
                      marginRight: 4,
                    }}
                  >
                    {"[E]"}
                  </button>
                  <button
                    type="button"
                    style={{
                      cursor: "pointer",
                      border: `1px solid ${HAIR_HOT}`,
                      borderRadius: 0,
                      background: "transparent",
                      color: RED,
                      fontFamily: MONO,
                      fontSize: 10,
                      padding: "1px 6px",
                    }}
                  >
                    {"[x]"}
                  </button>
                </td>
              </tr>
            );
          })}
          {/* add-row affordance */}
          <tr style={{ borderTop: `1px solid ${HAIR_HOT}`, background: BG_ALT }}>
            <td style={{ padding: "5px 12px", color: DIM }}>{"YYYY-MM-DD ▮"}</td>
            <td style={{ padding: "5px 12px", textAlign: "right", color: DIM }}>{"_____ ▮"}</td>
            <td style={{ padding: "5px 12px", textAlign: "right", color: DIM }}>—</td>
            <td style={{ padding: "5px 12px", textAlign: "right" }}>
              <button
                type="button"
                style={{
                  cursor: "pointer",
                  border: "none",
                  borderRadius: 0,
                  background: GREEN,
                  color: BG,
                  fontFamily: MONO,
                  fontWeight: 700,
                  fontSize: 10,
                  padding: "1px 8px",
                }}
              >
                {"[+ LOG]"}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
