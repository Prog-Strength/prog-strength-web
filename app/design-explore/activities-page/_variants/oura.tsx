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
  type Period,
  type TabId,
  type WeekPoint,
  type StatTile,
  type SessionCard as SessionCardT,
  type RunCard as RunCardT,
} from "../_fixtures";

/**
 * oura-calm-minimal — training as a calm instrument.
 * Desaturated, low-contrast, fine type, delicate single-stroke line charts.
 * Self-contained: this file owns its entire palette, type scale and chrome.
 */

// --- Palette -------------------------------------------------------------
const BG = "#0e0f12"; // soft dark, not pure black
const PANEL = "#15171b";
const PANEL_2 = "#191c21";
const HAIR = "rgba(255,255,255,0.06)";
const HAIR_STRONG = "rgba(255,255,255,0.1)";
const TEXT = "#c8cad0"; // muted off-white
const TEXT_DIM = "#7d818c";
const TEXT_FAINT = "#565a63";
const ACCENT = "#9aa6d6"; // desaturated periwinkle (lifting)
const ACCENT_2 = "#7fae9e"; // desaturated sage (running)
const POS = "#86b39f";
const NEG = "#c79292";

const FONT = "var(--dx-font-manrope), system-ui, sans-serif";
const NUM_TRACK = "-0.03em";

// --- Small primitives ----------------------------------------------------

function Panel({
  children,
  pad = 22,
  style,
}: {
  children: React.ReactNode;
  pad?: number;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL,
        border: `1px solid ${HAIR}`,
        borderRadius: 14,
        padding: pad,
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
        fontSize: 11,
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        color: TEXT_FAINT,
        fontWeight: 600,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function StatRow({ tiles }: { tiles: StatTile[] }): React.JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1,
        background: HAIR,
        border: `1px solid ${HAIR}`,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {tiles.map((t) => (
        <div key={t.key} style={{ background: PANEL, padding: "18px 20px" }}>
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.04em",
              color: TEXT_DIM,
              fontWeight: 500,
            }}
          >
            {t.label}
          </div>
          <div
            style={{
              marginTop: 9,
              display: "flex",
              alignItems: "baseline",
              gap: 5,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: TEXT,
                letterSpacing: NUM_TRACK,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {t.value}
            </span>
            {t.sub ? (
              <span style={{ fontSize: 12, color: TEXT_FAINT, fontWeight: 500 }}>{t.sub}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Signature dual-line weekly chart ------------------------------------

function DualLineChart({
  weeks,
  period,
}: {
  weeks: WeekPoint[];
  period: Period;
}): React.JSX.Element {
  const W = 760;
  const H = 200;
  const padX = 18;
  const padTop = 18;
  const padBottom = 34;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const [hover, setHover] = useState<number | null>(null);

  const liftHours = weeks.map((w) => w.liftMin / 60);
  const runHours = weeks.map((w) => w.runMin / 60);
  const maxH = Math.max(1, ...liftHours, ...runHours);
  const yMax = Math.ceil(maxH * 2) / 2 + 0.5;

  // single point (7d) — center it so the sparse case still reads intentional.
  const n = weeks.length;
  const xAt = (i: number) => (n === 1 ? padX + plotW / 2 : padX + (plotW * i) / (n - 1));
  const yAt = (h: number) => padTop + plotH - (h / yMax) * plotH;

  function path(vals: number[]): string {
    if (vals.length === 1) {
      const x = xAt(0);
      const y = yAt(vals[0]);
      return `M ${x - 8} ${y} L ${x + 8} ${y}`;
    }
    return vals
      .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(" ");
  }

  const gridLines = [0, 0.5, 1].map((f) => padTop + plotH - f * plotH);

  // Tick density: thin out when dense.
  const showEvery = n > 9 ? 2 : 1;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <SectionTitle>Weekly activity</SectionTitle>
        <div style={{ display: "flex", gap: 16 }}>
          <Legend color={ACCENT} label="Lifting" />
          <Legend color={ACCENT_2} label="Running" />
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          style={{ display: "block", overflow: "visible" }}
        >
          <defs>
            <linearGradient id="oura-lift-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.1} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>

          {/* hairline grid */}
          {gridLines.map((y, i) => (
            <line key={i} x1={padX} x2={W - padX} y1={y} y2={y} stroke={HAIR} strokeWidth={1} />
          ))}

          {/* soft fill under the lifting line only, very low opacity */}
          {n > 1 ? (
            <path
              d={`${path(liftHours)} L ${xAt(n - 1)} ${padTop + plotH} L ${xAt(0)} ${
                padTop + plotH
              } Z`}
              fill="url(#oura-lift-fill)"
              stroke="none"
            />
          ) : null}

          {/* two delicate 1px lines */}
          <path
            d={path(runHours)}
            fill="none"
            stroke={ACCENT_2}
            strokeWidth={1}
            strokeOpacity={0.85}
          />
          <path d={path(liftHours)} fill="none" stroke={ACCENT} strokeWidth={1} />

          {/* dots: emphasise rest week (both zero) and hovered week */}
          {weeks.map((w, i) => {
            const isRest = w.liftMin === 0 && w.runMin === 0;
            const isHover = hover === i;
            const baseY = padTop + plotH;
            return (
              <g key={w.weekStartMs}>
                {isRest ? (
                  <>
                    {/* rest marker — a quiet hollow tick on the baseline */}
                    <circle
                      cx={xAt(i)}
                      cy={baseY}
                      r={3}
                      fill={BG}
                      stroke={TEXT_FAINT}
                      strokeWidth={1}
                    />
                    <line
                      x1={xAt(i)}
                      x2={xAt(i)}
                      y1={padTop}
                      y2={baseY}
                      stroke={TEXT_FAINT}
                      strokeWidth={1}
                      strokeDasharray="2 4"
                      strokeOpacity={0.5}
                    />
                  </>
                ) : (
                  <>
                    <circle
                      cx={xAt(i)}
                      cy={yAt(w.liftMin / 60)}
                      r={isHover ? 3 : 2}
                      fill={ACCENT}
                    />
                    <circle
                      cx={xAt(i)}
                      cy={yAt(w.runMin / 60)}
                      r={isHover ? 3 : 2}
                      fill={ACCENT_2}
                      fillOpacity={0.85}
                    />
                  </>
                )}
                {/* hit area */}
                <rect
                  x={xAt(i) - plotW / Math.max(n, 1) / 2}
                  y={padTop}
                  width={Math.max(plotW / Math.max(n, 1), 14)}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "default" }}
                />
              </g>
            );
          })}

          {/* x ticks */}
          {weeks.map((w, i) =>
            i % showEvery === 0 ? (
              <text
                key={w.weekStartMs}
                x={xAt(i)}
                y={H - 12}
                fill={TEXT_FAINT}
                fontSize={10}
                textAnchor="middle"
                style={{ letterSpacing: "0.02em" }}
              >
                {w.tick}
              </text>
            ) : null,
          )}
        </svg>

        {/* tooltip-style label using range */}
        {hover !== null ? (
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              background: PANEL_2,
              border: `1px solid ${HAIR_STRONG}`,
              borderRadius: 10,
              padding: "8px 12px",
              display: "flex",
              gap: 16,
              alignItems: "center",
              pointerEvents: "none",
            }}
          >
            <span style={{ fontSize: 11, color: TEXT_DIM, letterSpacing: "0.02em" }}>
              {weeks[hover].range}
            </span>
            {weeks[hover].liftMin === 0 && weeks[hover].runMin === 0 ? (
              <span style={{ fontSize: 11, color: TEXT_FAINT, fontStyle: "italic" }}>
                Rest week
              </span>
            ) : (
              <>
                <TipVal color={ACCENT} v={hoursLabel(weeks[hover].liftMin)} />
                <TipVal color={ACCENT_2} v={hoursLabel(weeks[hover].runMin)} />
              </>
            )}
          </div>
        ) : (
          <div
            style={{
              position: "absolute",
              top: -2,
              left: 18,
              fontSize: 11,
              color: TEXT_FAINT,
            }}
          >
            {PERIODS.find((p) => p.id === period)?.label} · {n} {n === 1 ? "week" : "weeks"}
          </div>
        )}
      </div>
    </div>
  );
}

function hoursLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function TipVal({ color, v }: { color: string; v: string }): React.JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 7, height: 1.5, background: color, borderRadius: 1 }} />
      <span
        style={{
          fontSize: 12,
          color: TEXT,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: NUM_TRACK,
        }}
      >
        {v}
      </span>
    </span>
  );
}

function Legend({ color, label }: { color: string; label: string }): React.JSX.Element {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 12, height: 1.5, background: color, borderRadius: 1 }} />
      <span style={{ fontSize: 11, color: TEXT_DIM, letterSpacing: "0.02em" }}>{label}</span>
    </span>
  );
}

// --- Trend sparkline (workouts / running) --------------------------------

function Sparkline({ color }: { color: string }): React.JSX.Element {
  // Quiet decorative trend line derived from the weekly fixture.
  const vals = weeksForPeriod("90d").map((w) => w.liftMin + w.runMin);
  const W = 220;
  const H = 44;
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const span = Math.max(max - min, 1);
  const pts = vals.map((v, i) => {
    const x = (W * i) / (vals.length - 1);
    const y = H - 4 - ((v - min) / span) * (H - 8);
    return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: "block" }}>
      <path d={pts.join(" ")} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.7} />
    </svg>
  );
}

function SummaryBar({
  items,
  trendColor,
}: {
  items: { label: string; value: string }[];
  trendColor: string;
}): React.JSX.Element {
  return (
    <Panel>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
        }}
      >
        <div style={{ display: "flex", gap: 36, flexWrap: "wrap" }}>
          {items.map((it) => (
            <div key={it.label}>
              <div style={{ fontSize: 11, color: TEXT_DIM, letterSpacing: "0.04em" }}>
                {it.label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 600,
                  color: TEXT,
                  letterSpacing: NUM_TRACK,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {it.value}
              </div>
            </div>
          ))}
        </div>
        <div style={{ paddingTop: 4 }}>
          <div
            style={{
              fontSize: 10,
              color: TEXT_FAINT,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 4,
              textAlign: "right",
            }}
          >
            Trend
          </div>
          <Sparkline color={trendColor} />
        </div>
      </div>
    </Panel>
  );
}

// --- Cards ---------------------------------------------------------------

function SessionCard({ s }: { s: SessionCardT }): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL_2,
        border: `1px solid ${HAIR}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            minWidth: 0,
          }}
        >
          {s.name}
        </span>
        {s.isPR ? (
          <span
            style={{
              fontSize: 9.5,
              letterSpacing: "0.12em",
              color: ACCENT,
              border: `1px solid ${ACCENT}40`,
              borderRadius: 5,
              padding: "2px 6px",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            PR
          </span>
        ) : null}
        <span style={{ fontSize: 11, color: TEXT_FAINT, flexShrink: 0 }}>{s.when}</span>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 18,
          fontSize: 12,
          color: TEXT_DIM,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <MetaItem label="Duration" value={s.duration} />
        <MetaItem label="Exercises" value={String(s.exercises)} />
        <MetaItem label="Volume" value={`${s.volume} lb`} />
      </div>

      {s.note ? (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 12,
            lineHeight: 1.55,
            color: TEXT_FAINT,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {s.note}
        </p>
      ) : null}
    </div>
  );
}

function MetaItem({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: TEXT_FAINT, letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ color: TEXT, letterSpacing: NUM_TRACK }}>{value}</span>
    </span>
  );
}

function RunCard({ r }: { r: RunCardT }): React.JSX.Element {
  return (
    <div
      style={{
        background: PANEL_2,
        border: `1px solid ${HAIR}`,
        borderRadius: 12,
        padding: "14px 16px",
      }}
    >
      <div
        style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}
      >
        <span
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: TEXT,
            letterSpacing: "-0.01em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {r.name}
        </span>
        <span style={{ fontSize: 11, color: TEXT_FAINT, flexShrink: 0 }}>{r.when}</span>
      </div>
      <div
        style={{
          marginTop: 10,
          display: "flex",
          gap: 18,
          fontSize: 12,
          color: TEXT_DIM,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        <MetaItem label="Distance" value={r.distance} />
        <MetaItem label="Time" value={r.time} />
        <MetaItem label="Pace" value={r.pace} />
        <MetaItem label="Avg HR" value={r.hr} />
      </div>
    </div>
  );
}

function GroupHeader({
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
        padding: "0 2px 10px",
        borderBottom: `1px solid ${HAIR}`,
        marginBottom: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>
          {label}
        </span>
        <span style={{ fontSize: 11, color: TEXT_FAINT }}>{range}</span>
      </div>
      <span
        style={{
          fontSize: 11,
          color: TEXT_DIM,
          letterSpacing: "0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {meta}
      </span>
    </div>
  );
}

// --- Steps chart ---------------------------------------------------------

function StepsChart(): React.JSX.Element {
  const W = 760;
  const H = 200;
  const padX = 24;
  const padTop = 20;
  const padBottom = 36;
  const plotW = W - padX * 2;
  const plotH = H - padTop - padBottom;

  const maxSteps = Math.max(STEPS_GOAL, ...STEP_DAYS.map((d) => d.steps));
  const yMax = Math.ceil(maxSteps / 2000) * 2000;
  const yAt = (s: number) => padTop + plotH - (s / yMax) * plotH;

  const n = STEP_DAYS.length;
  const slot = plotW / n;
  const barW = Math.min(28, slot * 0.42);
  const goalY = yAt(STEPS_GOAL);

  return (
    <div>
      <SectionTitle>Daily steps</SectionTitle>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        style={{ display: "block", overflow: "visible" }}
      >
        {/* dashed goal line */}
        <line
          x1={padX}
          x2={W - padX}
          y1={goalY}
          y2={goalY}
          stroke={ACCENT}
          strokeWidth={1}
          strokeDasharray="4 4"
          strokeOpacity={0.6}
        />
        <text
          x={W - padX}
          y={goalY - 6}
          fill={ACCENT}
          fontSize={10}
          textAnchor="end"
          style={{ letterSpacing: "0.02em" }}
        >
          Goal {STEPS_GOAL.toLocaleString()}
        </text>

        {STEP_DAYS.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const top = yAt(d.steps);
          const isOver = d.state === "over";
          const fill = isOver ? ACCENT : "transparent";
          const stroke = isOver ? ACCENT : TEXT_FAINT;
          return (
            <g key={d.date}>
              <rect
                x={cx - barW / 2}
                y={top}
                width={barW}
                height={padTop + plotH - top}
                rx={3}
                fill={fill}
                fillOpacity={isOver ? 0.85 : 0}
                stroke={stroke}
                strokeWidth={1}
                strokeOpacity={isOver ? 0 : 0.6}
              />
              <text x={cx} y={H - 19} fill={TEXT_DIM} fontSize={10} textAnchor="middle">
                {d.dow}
              </text>
              <text x={cx} y={H - 7} fill={TEXT_FAINT} fontSize={9} textAnchor="middle">
                {d.date.replace("Jun ", "")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Period filter + tabs ------------------------------------------------

function PeriodPills({
  period,
  setPeriod,
}: {
  period: Period;
  setPeriod: (p: Period) => void;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "inline-flex",
        background: PANEL_2,
        border: `1px solid ${HAIR}`,
        borderRadius: 10,
        padding: 3,
        gap: 2,
      }}
    >
      {PERIODS.map((p) => {
        const active = p.id === period;
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriod(p.id)}
            style={{
              border: "none",
              cursor: "pointer",
              background: active ? "rgba(154,166,214,0.14)" : "transparent",
              color: active ? TEXT : TEXT_DIM,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "6px 12px",
              borderRadius: 7,
              transition: "background 0.15s, color 0.15s",
            }}
          >
            {p.short}
          </button>
        );
      })}
    </div>
  );
}

function PMark(): React.JSX.Element {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 7,
        border: `1px solid ${ACCENT}66`,
        color: ACCENT,
        fontWeight: 700,
        fontSize: 13,
        lineHeight: 1,
        letterSpacing: "-0.02em",
        background: "rgba(154,166,214,0.07)",
      }}
    >
      P
    </span>
  );
}

// --- Root ----------------------------------------------------------------

export function OuraVariant(): React.JSX.Element {
  const [tab, setTab] = useState<TabId>("overview");
  const [period, setPeriod] = useState<Period>("30d");

  const weeks = useMemo(() => weeksForPeriod(period), [period]);
  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div
      style={{
        fontFamily: FONT,
        background: BG,
        color: TEXT,
        minHeight: 820,
        padding: "26px 30px 60px",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* Header chrome */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <PMark />
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.02em", color: TEXT }}>
              Activities
            </div>
            <div style={{ fontSize: 11, color: TEXT_FAINT, letterSpacing: "0.02em" }}>
              Prog Strength
            </div>
          </div>
        </div>
        <PeriodPills period={period} setPeriod={setPeriod} />
      </header>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${HAIR}`,
          marginBottom: 26,
        }}
      >
        <nav style={{ display: "flex", gap: 4 }}>
          {TABS.map((t) => {
            const active = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "-0.005em",
                  color: active ? TEXT : TEXT_DIM,
                  padding: "10px 12px",
                  borderBottom: `1.5px solid ${active ? ACCENT : "transparent"}`,
                  marginBottom: -1,
                  transition: "color 0.15s",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>
        {activeTab?.action ? (
          <button
            type="button"
            style={{
              border: `1px solid ${HAIR_STRONG}`,
              background: PANEL_2,
              color: TEXT_DIM,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.02em",
              padding: "7px 13px",
              borderRadius: 8,
              marginBottom: 8,
            }}
          >
            {activeTab.action}
          </button>
        ) : null}
      </div>

      {/* Content */}
      {tab === "overview" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <StatRow tiles={OVERVIEW_STATS_PRIMARY} />
          <Panel>
            <DualLineChart weeks={weeks} period={period} />
          </Panel>
          <StatRow tiles={OVERVIEW_STATS_SECONDARY} />
          <StepsSummaryPanel />
        </div>
      ) : null}

      {tab === "workouts" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <SummaryBar
            trendColor={ACCENT}
            items={[
              { label: "Total time", value: WORKOUTS_SUMMARY.totalTime },
              { label: "Sessions", value: String(WORKOUTS_SUMMARY.sessions) },
              { label: "PRs", value: String(WORKOUTS_SUMMARY.prs) },
            ]}
          />
          {WORKOUT_WEEKS.map((wk) => (
            <div key={wk.id}>
              <GroupHeader
                label={wk.label}
                range={wk.range}
                meta={`${wk.totalTime} · ${wk.activities} ${wk.activities === 1 ? "activity" : "activities"}`}
              />
              {wk.sessions.length === 0 ? (
                <RestWeek />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {wk.sessions.map((s) => (
                    <SessionCard key={s.id} s={s} />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {tab === "running" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 1,
              background: HAIR,
              border: `1px solid ${HAIR}`,
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            {RUNNING_KPIS.map((k) => (
              <div key={k.key} style={{ background: PANEL, padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: TEXT_DIM, letterSpacing: "0.04em" }}>
                  {k.label}
                </div>
                <div style={{ marginTop: 9, display: "flex", alignItems: "baseline", gap: 5 }}>
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      color: TEXT,
                      letterSpacing: NUM_TRACK,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {k.value}
                  </span>
                  {k.sub ? <span style={{ fontSize: 12, color: TEXT_FAINT }}>{k.sub}</span> : null}
                </div>
                {/* delta tile color logic extends to negative / null */}
                {k.deltaPct != null ? (
                  <div
                    style={{
                      marginTop: 7,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: NUM_TRACK,
                      color: k.deltaPct >= 0 ? POS : NEG,
                    }}
                  >
                    {fmtDelta(k.deltaPct)}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <SummaryBar
            trendColor={ACCENT_2}
            items={[
              { label: "Distance", value: `${RUNNING_SUMMARY.totalDistance} mi` },
              { label: "Total time", value: RUNNING_SUMMARY.totalTime },
              { label: "Runs", value: String(RUNNING_SUMMARY.runs) },
            ]}
          />

          {RUN_MONTHS.map((m) => (
            <div key={m.id} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span
                  style={{ fontSize: 15, fontWeight: 600, color: TEXT, letterSpacing: "-0.02em" }}
                >
                  {m.label}
                </span>
                <span
                  style={{ fontSize: 11, color: TEXT_FAINT, fontVariantNumeric: "tabular-nums" }}
                >
                  {m.summary}
                </span>
              </div>
              {m.weeks.map((wk) => (
                <div key={wk.id}>
                  <GroupHeader label={wk.label} range={wk.range} meta={wk.summary} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {wk.runs.map((r) => (
                      <RunCard key={r.id} r={r} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : null}

      {tab === "steps" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <StatRow tiles={STEPS_KPIS} />
          <Panel>
            <StepsChart />
          </Panel>
          <StepLogTable />
        </div>
      ) : null}
    </div>
  );
}

function StepsSummaryPanel(): React.JSX.Element {
  const { avgDaily, goal, pctOfGoal } = STEPS_SUMMARY;
  return (
    <Panel>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}
      >
        <div>
          <SectionTitle>Steps</SectionTitle>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: TEXT,
                letterSpacing: NUM_TRACK,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {avgDaily.toLocaleString()}
            </span>
            <span style={{ fontSize: 12, color: TEXT_FAINT }}>avg / day</span>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: TEXT_DIM }}>
            {pctOfGoal}% of {goal.toLocaleString()} goal
          </div>
        </div>
        {/* slim progress meter */}
        <div style={{ flex: 1, maxWidth: 320 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              background: "rgba(255,255,255,0.05)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${pctOfGoal}%`,
                height: "100%",
                background: ACCENT,
                opacity: 0.85,
                borderRadius: 3,
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 7,
              fontSize: 10,
              color: TEXT_FAINT,
            }}
          >
            <span>0</span>
            <span>{goal.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RestWeek(): React.JSX.Element {
  return (
    <div
      style={{
        border: `1px dashed ${HAIR_STRONG}`,
        borderRadius: 12,
        padding: "20px 16px",
        textAlign: "center",
        background: "rgba(255,255,255,0.012)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_DIM, letterSpacing: "0.02em" }}>
        Rest week
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: TEXT_FAINT }}>
        {"No sessions logged — recovery by design."}
      </div>
    </div>
  );
}

function StepLogTable(): React.JSX.Element {
  return (
    <Panel pad={0}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px 14px",
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <SectionTitle>Step log</SectionTitle>
        <span style={{ fontSize: 11, color: TEXT_FAINT }}>{STEP_LOG.length} entries</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr auto",
          padding: "8px 20px",
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: TEXT_FAINT,
          borderBottom: `1px solid ${HAIR}`,
        }}
      >
        <span>Date</span>
        <span style={{ textAlign: "right" }}>Steps</span>
        <span />
      </div>
      {STEP_LOG.map((row) => {
        const over = row.steps >= STEPS_GOAL;
        return (
          <div
            key={row.id}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr auto",
              alignItems: "center",
              padding: "11px 20px",
              borderBottom: `1px solid ${HAIR}`,
              fontSize: 13,
            }}
          >
            <span style={{ color: TEXT_DIM, fontVariantNumeric: "tabular-nums" }}>{row.date}</span>
            <span
              style={{
                textAlign: "right",
                color: over ? TEXT : TEXT_DIM,
                fontVariantNumeric: "tabular-nums",
                letterSpacing: NUM_TRACK,
                fontWeight: over ? 600 : 500,
              }}
            >
              {row.steps.toLocaleString()}
            </span>
            <span
              style={{
                display: "inline-flex",
                gap: 8,
                justifyContent: "flex-end",
                paddingLeft: 24,
              }}
            >
              <RowAction label="Edit" />
              <RowAction label="Delete" />
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

function RowAction({ label }: { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      style={{
        border: "none",
        background: "transparent",
        cursor: "pointer",
        fontFamily: FONT,
        fontSize: 11,
        color: TEXT_FAINT,
        letterSpacing: "0.02em",
        padding: "2px 4px",
      }}
    >
      {label}
    </button>
  );
}
