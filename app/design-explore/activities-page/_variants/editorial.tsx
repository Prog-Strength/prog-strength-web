"use client";

import { useMemo, useState } from "react";
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
  WEEKLY,
  type Period,
  type TabId,
  type WeekPoint,
  type StatTile,
} from "../_fixtures";

/**
 * THROWAWAY DX variant — "editorial-data-journalism" direction.
 * Training as a data story: oversized Fraunces serif numerals, ink-on-near-black,
 * a single vermilion accent, captioned hand-rolled SVG charts.
 */

// --- Palette (owned entirely by this component) --------------------------
const INK = "#f4efe6"; // cream/ivory primary ink
const INK_DIM = "#a7a092"; // muted ink for body/meta
const INK_FAINT = "#6f695e"; // faintest captions / rules
const PAPER = "#15130f"; // warm near-black background
const PAPER_RAISED = "#1d1a15"; // slightly lifted panel
const RULE = "#2c2820"; // hairline rules
const ACCENT = "#e8552d"; // the ONE editorial accent — vermilion
const RUN_INK = "#cdbfa6"; // outline series tint (still inky, not a 2nd accent)

const SERIF = "var(--dx-font-fraunces), Georgia, serif";
const SANS = "system-ui, sans-serif";

const capStyle: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 10.5,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: INK_FAINT,
  fontWeight: 600,
};

const captionStyle: React.CSSProperties = {
  fontFamily: SERIF,
  fontStyle: "italic",
  fontSize: 13.5,
  lineHeight: 1.5,
  color: INK_DIM,
  maxWidth: 560,
};

// =========================================================================

export function EditorialVariant(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  return (
    <div
      style={{
        background: PAPER,
        color: INK,
        minHeight: 820,
        fontFamily: SERIF,
        padding: "0 0 80px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Masthead period={period} setPeriod={setPeriod} />
      <TabBar tab={tab} setTab={setTab} />

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "0 48px" }}>
        {tab === "overview" && <OverviewTab period={period} />}
        {tab === "workouts" && <WorkoutsTab />}
        {tab === "running" && <RunningTab />}
        {tab === "steps" && <StepsTab />}
      </div>
    </div>
  );
}

// --- Masthead / dateline -------------------------------------------------

function Masthead({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}): React.JSX.Element {
  return (
    <header
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "34px 48px 22px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <BrandMark />
          <div style={{ ...capStyle, color: INK_DIM, lineHeight: 1.6 }}>
            Prog Strength
            <br />
            <span style={{ color: INK_FAINT, letterSpacing: "0.24em" }}>{"The Training Desk"}</span>
          </div>
        </div>

        <PeriodPicker period={period} setPeriod={setPeriod} />
      </div>

      <div
        style={{
          marginTop: 28,
          borderTop: `1px solid ${RULE}`,
          borderBottom: `1px solid ${RULE}`,
          padding: "18px 0",
        }}
      >
        <div style={{ ...capStyle, color: ACCENT, marginBottom: 10 }}>
          {"Activities · A Training Month in Review"}
        </div>
        <h1
          style={{
            fontFamily: SERIF,
            fontSize: 40,
            lineHeight: 1.05,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            margin: 0,
            maxWidth: 760,
          }}
        >
          {"Eight lifts, five runs, and a week off — how the month actually went."}
        </h1>
        <div
          style={{
            ...capStyle,
            color: INK_FAINT,
            marginTop: 14,
            fontWeight: 500,
            letterSpacing: "0.14em",
          }}
        >
          {"By the Numbers · Jun 18, 2026 · "}
          {PERIODS.find((p) => p.id === period)?.label}
        </div>
      </div>
    </header>
  );
}

function BrandMark(): React.JSX.Element {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 3,
        background: ACCENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
      aria-hidden
    >
      <span
        style={{
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: 26,
          color: PAPER,
          lineHeight: 1,
          marginTop: -2,
        }}
      >
        P
      </span>
    </div>
  );
}

function PeriodPicker({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}): React.JSX.Element {
  return (
    <div style={{ display: "flex", gap: 0, alignItems: "baseline" }}>
      {PERIODS.map((p, i) => {
        const active = p.id === period;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px 12px",
              borderLeft: i === 0 ? "none" : `1px solid ${RULE}`,
              fontFamily: SANS,
              fontSize: 11,
              letterSpacing: "0.14em",
              fontWeight: 700,
              color: active ? ACCENT : INK_FAINT,
            }}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
}

// --- Tab bar -------------------------------------------------------------

function TabBar({ tab, setTab }: { tab: TabId; setTab: (t: TabId) => void }): React.JSX.Element {
  const active = TABS.find((t) => t.id === tab);
  return (
    <nav
      style={{
        maxWidth: 1080,
        margin: "0 auto",
        padding: "16px 48px 4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", gap: 30 }}>
        {TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "6px 0 10px",
                fontFamily: SANS,
                fontSize: 11.5,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                fontWeight: 700,
                color: on ? INK : INK_FAINT,
                borderBottom: on ? `2px solid ${ACCENT}` : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {active?.action && (
        <span
          style={{
            ...capStyle,
            color: INK_DIM,
            border: `1px solid ${RULE}`,
            borderRadius: 2,
            padding: "6px 11px",
            cursor: "pointer",
          }}
        >
          {active.action}
        </span>
      )}
    </nav>
  );
}

// --- Shared small pieces -------------------------------------------------

function SectionLabel({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div
      style={{
        ...capStyle,
        color: INK_DIM,
        marginBottom: 18,
        paddingBottom: 8,
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      {children}
    </div>
  );
}

/** A small stat in the editorial idiom: tiny caption above, serif figure below. */
function StatItem({
  tile,
  accent = false,
}: {
  tile: StatTile;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div style={{ ...capStyle, marginBottom: 6 }}>{tile.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 44,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: accent ? ACCENT : INK,
          }}
        >
          {tile.value}
        </span>
        {tile.sub && (
          <span style={{ ...capStyle, color: INK_FAINT, letterSpacing: "0.1em" }}>{tile.sub}</span>
        )}
      </div>
    </div>
  );
}

function StatRow({
  tiles,
  accentKey,
}: {
  tiles: StatTile[];
  accentKey?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 28,
        padding: "26px 0",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      {tiles.map((t) => (
        <StatItem key={t.key} tile={t} accent={t.key === accentKey} />
      ))}
    </div>
  );
}

// =========================================================================
// OVERVIEW
// =========================================================================

function OverviewTab({ period }: { period: Period }): React.JSX.Element {
  const weeks = useMemo(() => weeksForPeriod(period), [period]);

  return (
    <section style={{ paddingTop: 30 }}>
      <StatRow tiles={OVERVIEW_STATS_PRIMARY} accentKey="time" />

      <div style={{ padding: "34px 0 8px" }}>
        <SectionLabel>{"The Month in Hours · Lifting vs Running"}</SectionLabel>
        <WeeklyDualChart weeks={weeks} />
        <p style={{ ...captionStyle, marginTop: 16 }}>
          {weeks.length <= 1
            ? "A single week in frame — the most recent training block, lifting carrying the load while running stays a steady undercurrent."
            : "Lifting (solid) is the bedrock; running (outlined) the lighter trace. The dip at the week of May 25 is a planned deload — a week off, not missing data — before the Jun 1 peak of nearly five hours under the bar."}
        </p>
      </div>

      <StatRow tiles={OVERVIEW_STATS_SECONDARY} accentKey="volume" />

      <StepsSummaryStrip />
    </section>
  );
}

function WeeklyDualChart({ weeks }: { weeks: WeekPoint[] }): React.JSX.Element {
  const [hover, setHover] = useState<number | null>(null);
  const W = 984;
  const H = 280;
  const padL = 8;
  const padR = 8;
  const padT = 18;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  // Scale across the full dataset max so period slices stay comparable.
  const maxMin = Math.max(...WEEKLY.map((w) => Math.max(w.liftMin, w.runMin)), 60);
  const n = weeks.length;
  const step = innerW / Math.max(n, 1);
  const cx = (i: number): number => padL + step * i + step / 2;
  const y = (min: number): number => padT + innerH - (min / maxMin) * innerH;

  const liftPts = weeks.map((w, i) => `${cx(i)},${y(w.liftMin)}`);
  const runPts = weeks.map((w, i) => `${cx(i)},${y(w.runMin)}`);

  // Filled area under the lifting (solid) series.
  const areaPath =
    `M ${cx(0)},${padT + innerH} ` +
    weeks.map((w, i) => `L ${cx(i)},${y(w.liftMin)}`).join(" ") +
    ` L ${cx(n - 1)},${padT + innerH} Z`;

  const active = hover ?? n - 1;
  const aw = weeks[active];
  const single = n === 1;

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* gridlines at quarters */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={padL}
            x2={W - padR}
            y1={padT + innerH - f * innerH}
            y2={padT + innerH - f * innerH}
            stroke={RULE}
            strokeWidth={1}
          />
        ))}

        {/* lifting filled area + line */}
        <path d={areaPath} fill={ACCENT} fillOpacity={0.16} />
        <polyline
          points={liftPts.join(" ")}
          fill="none"
          stroke={ACCENT}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />

        {/* running outlined (stroke-only) line */}
        <polyline
          points={runPts.join(" ")}
          fill="none"
          stroke={RUN_INK}
          strokeWidth={1.6}
          strokeDasharray="1 0"
          strokeLinejoin="round"
        />

        {/* per-week markers + rest-week call-out */}
        {weeks.map((w, i) => {
          const rest = w.liftMin === 0 && w.runMin === 0;
          return (
            <g key={w.weekStartMs}>
              {/* hover hit-area */}
              <rect
                x={padL + step * i}
                y={padT}
                width={step}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
              {rest && (
                <>
                  <circle
                    cx={cx(i)}
                    cy={padT + innerH}
                    r={4}
                    fill={PAPER}
                    stroke={INK_FAINT}
                    strokeWidth={1.4}
                  />
                  <text
                    x={cx(i)}
                    y={padT + innerH - 14}
                    textAnchor="middle"
                    fontFamily={SANS}
                    fontSize={9.5}
                    letterSpacing="0.14em"
                    fill={INK_FAINT}
                    style={{ textTransform: "uppercase" }}
                  >
                    REST
                  </text>
                </>
              )}
              {!rest && (
                <>
                  <circle cx={cx(i)} cy={y(w.liftMin)} r={i === active ? 4 : 2.6} fill={ACCENT} />
                  <circle
                    cx={cx(i)}
                    cy={y(w.runMin)}
                    r={i === active ? 3.6 : 2.4}
                    fill={PAPER}
                    stroke={RUN_INK}
                    strokeWidth={1.4}
                  />
                </>
              )}
              {/* x tick */}
              <text
                x={cx(i)}
                y={H - 14}
                textAnchor="middle"
                fontFamily={SANS}
                fontSize={9.5}
                letterSpacing="0.1em"
                fill={i === active ? INK : INK_FAINT}
                style={{ textTransform: "uppercase" }}
              >
                {w.tick}
              </text>
            </g>
          );
        })}

        {/* active week vertical guide */}
        {!single && (
          <line
            x1={cx(active)}
            x2={cx(active)}
            y1={padT}
            y2={padT + innerH}
            stroke={INK_FAINT}
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        )}
      </svg>

      {/* tooltip-style label (static for the active week) */}
      <div
        style={{
          marginTop: 6,
          display: "flex",
          gap: 28,
          alignItems: "baseline",
          flexWrap: "wrap",
        }}
      >
        <span style={{ ...capStyle, color: INK, letterSpacing: "0.16em" }}>{aw.range}</span>
        <Legend swatch={ACCENT} solid label="Lifting" value={fmtHours(aw.liftMin)} />
        <Legend swatch={RUN_INK} solid={false} label="Running" value={fmtHours(aw.runMin)} />
        {aw.liftMin === 0 && aw.runMin === 0 && (
          <span style={{ ...capStyle, color: ACCENT, letterSpacing: "0.14em" }}>
            {"Planned deload"}
          </span>
        )}
      </div>
    </div>
  );
}

function Legend({
  swatch,
  solid,
  label,
  value,
}: {
  swatch: string;
  solid: boolean;
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 16,
          height: 0,
          borderTop: `${solid ? 3 : 2}px ${solid ? "solid" : "dashed"} ${swatch}`,
          display: "inline-block",
        }}
      />
      <span style={{ ...capStyle, color: INK_DIM }}>{label}</span>
      <span style={{ fontFamily: SERIF, fontSize: 18, color: INK, fontWeight: 600 }}>{value}</span>
    </span>
  );
}

function fmtHours(min: number): string {
  const h = min / 60;
  if (min === 0) return "0h";
  const whole = Math.floor(h);
  const rem = Math.round(min - whole * 60);
  if (whole === 0) return `${rem}m`;
  return rem === 0 ? `${whole}h` : `${whole}h ${rem}m`;
}

function StepsSummaryStrip(): React.JSX.Element {
  const { avgDaily, goal, pctOfGoal } = STEPS_SUMMARY;
  return (
    <div
      style={{
        marginTop: 34,
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 40,
        alignItems: "center",
        padding: "30px 0 8px",
      }}
    >
      <div>
        <SectionLabel>{"Steps · The Daily Floor"}</SectionLabel>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 92,
              fontWeight: 600,
              lineHeight: 0.9,
              letterSpacing: "-0.03em",
            }}
          >
            {avgDaily.toLocaleString()}
          </span>
          <span style={{ ...capStyle, letterSpacing: "0.12em" }}>{"avg / day"}</span>
        </div>
        <p style={{ ...captionStyle, marginTop: 14 }}>
          {"Holding at "}
          <span style={{ color: ACCENT, fontStyle: "normal", fontWeight: 600 }}>{pctOfGoal}%</span>
          {` of the ${goal.toLocaleString()}-step goal — close, but the legs are clearly carrying the runs more than the daily count.`}
        </p>
      </div>
      <GoalDial pct={pctOfGoal} />
    </div>
  );
}

function GoalDial({ pct }: { pct: number }): React.JSX.Element {
  const r = 64;
  const c = 2 * Math.PI * r;
  const filled = (pct / 100) * c;
  return (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <svg width={170} height={170} viewBox="0 0 170 170">
        <circle cx={85} cy={85} r={r} fill="none" stroke={RULE} strokeWidth={10} />
        <circle
          cx={85}
          cy={85}
          r={r}
          fill="none"
          stroke={ACCENT}
          strokeWidth={10}
          strokeLinecap="butt"
          strokeDasharray={`${filled} ${c - filled}`}
          transform="rotate(-90 85 85)"
        />
        <text
          x={85}
          y={82}
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize={38}
          fontWeight={600}
          fill={INK}
        >
          {pct}%
        </text>
        <text
          x={85}
          y={104}
          textAnchor="middle"
          fontFamily={SANS}
          fontSize={9.5}
          letterSpacing="0.18em"
          fill={INK_FAINT}
          style={{ textTransform: "uppercase" }}
        >
          OF GOAL
        </text>
      </svg>
    </div>
  );
}

// =========================================================================
// WORKOUTS
// =========================================================================

function WorkoutsTab(): React.JSX.Element {
  return (
    <section style={{ paddingTop: 30 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 28,
          paddingBottom: 28,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        <HeroFigure value={WORKOUTS_SUMMARY.totalTime} label="Total time under the bar" accent />
        <HeroFigure value={String(WORKOUTS_SUMMARY.sessions)} label="Sessions" />
        <HeroFigure value={String(WORKOUTS_SUMMARY.prs)} label="Personal records" />
      </div>

      <div style={{ padding: "32px 0 8px" }}>
        <SectionLabel>{"Volume per Session · Recent Trend"}</SectionLabel>
        <TrendBars
          values={[29090, 17875, 41200, 52310, 31140, 38135]}
          accentIdx={3}
          unit="lb volume"
        />
        <p style={{ ...captionStyle, marginTop: 14 }}>
          {
            "The Jun 6 deadlift session tops the block at 52,310 lb of total volume — a new 405 lb pull and the heaviest day of the month."
          }
        </p>
      </div>

      <div style={{ paddingTop: 26 }}>
        <SectionLabel>{"The Log · Week by Week"}</SectionLabel>
        {WORKOUT_WEEKS.map((wk) => (
          <div key={wk.id} style={{ marginBottom: 30 }}>
            <WeekHeader
              label={wk.label}
              range={wk.range}
              meta={`${wk.totalTime} · ${wk.activities} ${wk.activities === 1 ? "activity" : "activities"}`}
            />
            {wk.sessions.length === 0 ? (
              <RestWeekBlock />
            ) : (
              wk.sessions.map((s) => <SessionRow key={s.id} session={s} />)
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function HeroFigure({
  value,
  label,
  accent = false,
}: {
  value: string;
  label: string;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <div>
      <div
        style={{
          fontFamily: SERIF,
          fontSize: 78,
          fontWeight: 600,
          lineHeight: 0.92,
          letterSpacing: "-0.03em",
          color: accent ? ACCENT : INK,
        }}
      >
        {value}
      </div>
      <div style={{ ...capStyle, marginTop: 10 }}>{label}</div>
    </div>
  );
}

function WeekHeader({
  label,
  range,
  meta,
}: {
  label: string;
  range: string;
  meta: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        borderBottom: `1px solid ${RULE}`,
        paddingBottom: 8,
        marginBottom: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600 }}>{label}</span>
        <span style={{ ...capStyle, letterSpacing: "0.12em" }}>{range}</span>
      </div>
      <span style={{ ...capStyle, color: INK_DIM }}>{meta}</span>
    </div>
  );
}

function RestWeekBlock(): React.JSX.Element {
  return (
    <div
      style={{
        border: `1px dashed ${RULE}`,
        borderRadius: 3,
        padding: "26px 24px",
        textAlign: "center",
        background: PAPER_RAISED,
      }}
    >
      <div style={{ ...capStyle, color: ACCENT, letterSpacing: "0.2em", marginBottom: 8 }}>
        {"Rest Week — By Design"}
      </div>
      <p style={{ ...captionStyle, margin: "0 auto" }}>
        {
          "No sessions logged, and that is the point: a programmed deload to bank recovery before the Jun 1 peak. The quiet week is the work."
        }
      </p>
    </div>
  );
}

function SessionRow({
  session,
}: {
  session: (typeof WORKOUT_WEEKS)[number]["sessions"][number];
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 220px",
        gap: 28,
        padding: "16px 0",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {session.isPR && (
            <span
              style={{
                ...capStyle,
                color: ACCENT,
                letterSpacing: "0.12em",
                border: `1px solid ${ACCENT}`,
                borderRadius: 2,
                padding: "2px 6px",
                fontSize: 9.5,
              }}
            >
              🏆 PR
            </span>
          )}
          <span
            style={{
              fontFamily: SERIF,
              fontSize: 21,
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {session.name}
          </span>
        </div>
        <div style={{ ...capStyle, color: INK_FAINT, marginTop: 6, letterSpacing: "0.1em" }}>
          {session.when}
        </div>
        {session.note && (
          <p
            style={{
              fontFamily: SERIF,
              fontStyle: "italic",
              fontSize: 13.5,
              lineHeight: 1.5,
              color: INK_DIM,
              margin: "10px 0 0",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {session.note}
          </p>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
        <MetaPair label="Duration" value={session.duration} />
        <MetaPair label="Exercises" value={String(session.exercises)} />
        <MetaPair label="Volume" value={`${session.volume} lb`} />
      </div>
    </div>
  );
}

function MetaPair({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, justifyContent: "flex-end" }}>
      <span style={{ ...capStyle, letterSpacing: "0.1em" }}>{label}</span>
      <span style={{ fontFamily: SERIF, fontSize: 17, fontWeight: 600, color: INK }}>{value}</span>
    </div>
  );
}

// =========================================================================
// RUNNING
// =========================================================================

function RunningTab(): React.JSX.Element {
  return (
    <section style={{ paddingTop: 30 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 28,
          paddingBottom: 28,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        {RUNNING_KPIS.map((kpi) => (
          <RunKpi key={kpi.key} kpi={kpi} accent={kpi.key === "week"} />
        ))}
      </div>

      <div style={{ padding: "32px 0 8px" }}>
        <SectionLabel>
          {`Distance per Run · ${RUNNING_SUMMARY.totalDistance} mi over ${RUNNING_SUMMARY.runs} runs`}
        </SectionLabel>
        <TrendBars values={[4.2, 3.1, 4.4, 5.2, 5.4]} accentIdx={0} unit="mi" />
        <p style={{ ...captionStyle, marginTop: 14 }}>
          {`A modest ${RUNNING_SUMMARY.totalTime} on foot this month — running is the steady undertone to the lifting, with this week's 4.2 mi up `}
          <span style={{ color: ACCENT, fontStyle: "normal", fontWeight: 600 }}>
            {fmtDelta(18)}
          </span>
          {" on the prior week."}
        </p>
      </div>

      <div style={{ paddingTop: 26 }}>
        <SectionLabel>{"The Log · By Month"}</SectionLabel>
        {RUN_MONTHS.map((m) => (
          <div key={m.id} style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                marginBottom: 16,
              }}
            >
              <span style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600 }}>{m.label}</span>
              <span style={{ ...capStyle, color: INK_DIM }}>{m.summary}</span>
            </div>
            {m.weeks.map((wk) => (
              <div key={wk.id} style={{ marginBottom: 22 }}>
                <WeekHeader label={wk.label} range={wk.range} meta={wk.summary} />
                {wk.runs.map((r) => (
                  <RunRow key={r.id} run={r} />
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function RunKpi({
  kpi,
  accent = false,
}: {
  kpi: (typeof RUNNING_KPIS)[number];
  accent?: boolean;
}): React.JSX.Element {
  const hasDelta = typeof kpi.deltaPct === "number";
  // Color logic extends to negative/null: up=accent-green, down=warm, none=nothing.
  const up = hasDelta && (kpi.deltaPct as number) >= 0;
  return (
    <div>
      <div style={{ ...capStyle, marginBottom: 6 }}>{kpi.label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: SERIF,
            fontSize: 46,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: accent ? ACCENT : INK,
          }}
        >
          {kpi.value}
        </span>
        {kpi.sub && (
          <span style={{ ...capStyle, color: INK_FAINT, letterSpacing: "0.08em" }}>{kpi.sub}</span>
        )}
      </div>
      {hasDelta && (
        <div
          style={{
            ...capStyle,
            marginTop: 6,
            letterSpacing: "0.1em",
            color: up ? "#6fae7a" : "#d98a6a",
          }}
        >
          {up ? "▲ " : "▼ "}
          {fmtDelta(kpi.deltaPct as number)}
          {" vs prior"}
        </div>
      )}
    </div>
  );
}

function RunRow({
  run,
}: {
  run: (typeof RUN_MONTHS)[number]["weeks"][number]["runs"][number];
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: 24,
        alignItems: "center",
        padding: "14px 0",
        borderBottom: `1px solid ${RULE}`,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: SERIF,
            fontSize: 20,
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {run.name}
        </div>
        <div style={{ ...capStyle, color: INK_FAINT, marginTop: 5, letterSpacing: "0.1em" }}>
          {run.when}
        </div>
      </div>
      <div style={{ display: "flex", gap: 24 }}>
        <RunStat label="Dist" value={run.distance} big />
        <RunStat label="Time" value={run.time} />
        <RunStat label="Pace" value={run.pace} />
        <RunStat label="HR" value={run.hr} />
      </div>
    </div>
  );
}

function RunStat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: string;
  big?: boolean;
}): React.JSX.Element {
  return (
    <div style={{ textAlign: "right", minWidth: 64 }}>
      <div style={{ ...capStyle, marginBottom: 4, letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontFamily: SERIF, fontSize: big ? 22 : 18, fontWeight: 600, color: INK }}>
        {value}
      </div>
    </div>
  );
}

// =========================================================================
// STEPS
// =========================================================================

function StepsTab(): React.JSX.Element {
  return (
    <section style={{ paddingTop: 30 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 28,
          paddingBottom: 28,
          borderBottom: `1px solid ${RULE}`,
        }}
      >
        {STEPS_KPIS.map((k) => (
          <StatItem key={k.key} tile={k} accent={k.key === "goal"} />
        ))}
      </div>

      <div style={{ padding: "34px 0 8px" }}>
        <SectionLabel>{"Daily Steps vs the 10,000 Line"}</SectionLabel>
        <StepsBarChart />
        <p style={{ ...captionStyle, marginTop: 16 }}>
          {
            "Only Jun 12 and Jun 14 cleared the dashed goal line; the back half of the week fell well short. The goal is the reference — over reads as a win, under as ground to make up."
          }
        </p>
      </div>

      <div style={{ paddingTop: 26 }}>
        <SectionLabel>{"The Step Log"}</SectionLabel>
        <StepLogTable />
      </div>
    </section>
  );
}

function StepsBarChart(): React.JSX.Element {
  const W = 984;
  const H = 280;
  const padL = 8;
  const padR = 8;
  const padT = 24;
  const padB = 40;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxV = Math.max(STEPS_GOAL, ...STEP_DAYS.map((d) => d.steps)) * 1.05;
  const n = STEP_DAYS.length;
  const slot = innerW / n;
  const barW = slot * 0.46;
  const yOf = (v: number): number => padT + innerH - (v / maxV) * innerH;
  const goalY = yOf(STEPS_GOAL);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", overflow: "visible" }}
    >
      {STEP_DAYS.map((d, i) => {
        const x = padL + slot * i + slot / 2;
        const top = yOf(d.steps);
        const over = d.state === "over";
        const at = d.state === "at";
        // over = solid accent (a win); under = hollow ink outline; at = solid ink.
        const fill = over ? ACCENT : at ? INK_DIM : "transparent";
        const stroke = over ? ACCENT : at ? INK_DIM : INK_FAINT;
        return (
          <g key={d.date}>
            <rect
              x={x - barW / 2}
              y={top}
              width={barW}
              height={padT + innerH - top}
              fill={fill}
              stroke={stroke}
              strokeWidth={1.4}
              rx={1}
            />
            <text
              x={x}
              y={top - 8}
              textAnchor="middle"
              fontFamily={SERIF}
              fontSize={13}
              fontWeight={600}
              fill={over ? ACCENT : INK_DIM}
            >
              {(d.steps / 1000).toFixed(d.steps % 1000 === 0 ? 0 : 1)}k
            </text>
            <text
              x={x}
              y={H - 22}
              textAnchor="middle"
              fontFamily={SANS}
              fontSize={9.5}
              letterSpacing="0.1em"
              fill={INK_FAINT}
              style={{ textTransform: "uppercase" }}
            >
              {d.dow}
            </text>
            <text
              x={x}
              y={H - 10}
              textAnchor="middle"
              fontFamily={SANS}
              fontSize={9}
              letterSpacing="0.06em"
              fill={INK_FAINT}
            >
              {d.date.replace("Jun ", "")}
            </text>
          </g>
        );
      })}

      {/* dashed goal line */}
      <line
        x1={padL}
        x2={W - padR}
        y1={goalY}
        y2={goalY}
        stroke={INK}
        strokeWidth={1.4}
        strokeDasharray="6 5"
      />
      <text
        x={W - padR}
        y={goalY - 7}
        textAnchor="end"
        fontFamily={SANS}
        fontSize={10}
        letterSpacing="0.16em"
        fill={INK}
        style={{ textTransform: "uppercase" }}
      >
        GOAL 10,000
      </text>
    </svg>
  );
}

function StepLogTable(): React.JSX.Element {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th
            style={{
              ...capStyle,
              textAlign: "left",
              padding: "0 0 10px",
              borderBottom: `1px solid ${RULE}`,
            }}
          >
            Date
          </th>
          <th
            style={{
              ...capStyle,
              textAlign: "right",
              padding: "0 0 10px",
              borderBottom: `1px solid ${RULE}`,
            }}
          >
            Steps
          </th>
          <th
            style={{
              ...capStyle,
              textAlign: "right",
              padding: "0 0 10px",
              borderBottom: `1px solid ${RULE}`,
              width: 120,
            }}
          >
            {""}
          </th>
        </tr>
      </thead>
      <tbody>
        {STEP_LOG.map((row) => {
          const over = row.steps >= STEPS_GOAL;
          return (
            <tr key={row.id}>
              <td
                style={{
                  fontFamily: SERIF,
                  fontSize: 17,
                  color: INK,
                  padding: "13px 0",
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                {row.date}
              </td>
              <td
                style={{
                  fontFamily: SERIF,
                  fontSize: 19,
                  fontWeight: 600,
                  textAlign: "right",
                  padding: "13px 0",
                  borderBottom: `1px solid ${RULE}`,
                  color: over ? ACCENT : INK,
                }}
              >
                {row.steps.toLocaleString()}
              </td>
              <td
                style={{
                  textAlign: "right",
                  padding: "13px 0",
                  borderBottom: `1px solid ${RULE}`,
                }}
              >
                <span style={{ ...capStyle, color: INK_DIM, cursor: "pointer", marginRight: 14 }}>
                  Edit
                </span>
                <span style={{ ...capStyle, color: INK_FAINT, cursor: "pointer" }}>Delete</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// --- Generic trend bars (used by Workouts + Running) ---------------------

function TrendBars({
  values,
  accentIdx,
  unit,
}: {
  values: number[];
  accentIdx: number;
  unit: string;
}): React.JSX.Element {
  const W = 984;
  const H = 150;
  const padT = 10;
  const padB = 8;
  const innerH = H - padT - padB;
  const maxV = Math.max(...values) * 1.08;
  const n = values.length;
  const slot = W / n;
  const barW = slot * 0.4;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      height={H}
      style={{ display: "block", overflow: "visible" }}
    >
      <line x1={0} x2={W} y1={padT + innerH} y2={padT + innerH} stroke={RULE} strokeWidth={1} />
      {values.map((v, i) => {
        const h = (v / maxV) * innerH;
        const x = slot * i + slot / 2;
        const on = i === accentIdx;
        return (
          <g key={i}>
            <rect
              x={x - barW / 2}
              y={padT + innerH - h}
              width={barW}
              height={h}
              fill={on ? ACCENT : "transparent"}
              stroke={on ? ACCENT : INK_FAINT}
              strokeWidth={1.4}
              rx={1}
            />
          </g>
        );
      })}
      <text
        x={0}
        y={padT + 12}
        fontFamily={SANS}
        fontSize={10}
        letterSpacing="0.14em"
        fill={INK_FAINT}
        style={{ textTransform: "uppercase" }}
      >
        {unit}
      </text>
    </svg>
  );
}
