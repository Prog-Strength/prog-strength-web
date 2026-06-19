"use client";

/**
 * IDIOM: command-center — Linear's earned density / a trading console.
 *
 * Composition: the dense power-user console. A compact KPI strip across the
 * top puts every domain's headline number in one scannable row; the chat bar
 * is a COMMAND bar; beneath, tight mini-cards with sparklines pack maximum
 * signal into minimum space. Small functional type, a very tight rhythm,
 * status-encoded color. The deliberate-density opposite of feed-digest — the
 * one that shows the most without scrolling — but it must stay CALM and
 * on-brand, not read as a trading terminal.
 *
 * Distinct by: smallest type scale of the five, tabular KPI alignment +
 * hairline grouping, status-encoded deltas (success/danger), tight gap-2
 * spacing rhythm, mono numerals. Earned density, single-accent restraint.
 *
 * In-system: v0.4 tokens only — periwinkle as the command-bar accent + active
 * chrome; discipline dots tag run/lift; desaturated success/danger carry the
 * deltas (status color, never the accent). Stays on the near-black field.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DEEP_LINKS, WEEKDAYS, type DashboardData } from "../_fixtures/data";

export function CommandCenterVariant({ data, loading }: { data: DashboardData; loading: boolean }) {
  return (
    <div className="px-4 py-5 sm:px-6">
      {/* KPI strip ------------------------------------------------------- */}
      <div className="grid grid-cols-2 divide-[var(--border)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <Kpi
          label="Streak"
          value={data.streak.weeks > 0 ? `${data.streak.weeks}w` : "—"}
          sub={`${data.streak.activeDaysThisWeek}/7 active`}
          loading={loading}
          accent
        />
        <Kpi
          label="Run"
          value={data.running ? `${data.running.weekDistanceMi}mi` : "—"}
          sub={data.running ? `${data.running.runCount} runs` : "no runs"}
          delta={data.running?.deltaPct ?? null}
          loading={loading}
          dot="var(--discipline-run-dot)"
        />
        <Kpi
          label="Lift"
          value={data.lifting ? data.lifting.weekTime : "—"}
          sub={data.lifting ? `${data.lifting.sets} sets` : "no lifts"}
          loading={loading}
          dot="var(--discipline-lift-dot)"
        />
        <Kpi
          label="Steps"
          value={data.steps ? compact(data.steps.avg) : "—"}
          sub={
            data.steps?.goal
              ? `${Math.round((data.steps.avg / data.steps.goal) * 100)}% goal`
              : "no goal"
          }
          loading={loading}
        />
        <Kpi
          label="Fuel"
          value={data.nutrition ? compact(data.nutrition.calories) : "—"}
          sub={data.nutrition ? "kcal" : "unlogged"}
          loading={loading}
        />
        <Kpi
          label="Weight"
          value={data.bodyweight ? `${data.bodyweight.current}` : "—"}
          sub={
            data.bodyweight
              ? `${data.bodyweight.ratePerWeek > 0 ? "+" : ""}${data.bodyweight.ratePerWeek}/wk`
              : "unlogged"
          }
          loading={loading}
        />
      </div>

      <CommandBar />

      {/* Dense mini-card grid -------------------------------------------- */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <MiniCard
          href={DEEP_LINKS.running}
          dot="var(--discipline-run-dot)"
          label="Running · wk"
          loading={loading}
          empty={!data.running}
          emptyCta="Log a run"
        >
          {data.running && (
            <>
              <BigNum>
                {data.running.weekDistanceMi}
                <U>mi</U>
              </BigNum>
              <Spark points={data.running.spark} color="var(--discipline-run-dot)" />
              <MetaRow
                items={[
                  ["runs", String(data.running.runCount)],
                  ["pace", data.running.avgPace?.replace(" /mi", "") ?? "—"],
                  [
                    "Δwk",
                    data.running.deltaPct != null
                      ? `${data.running.deltaPct >= 0 ? "+" : ""}${data.running.deltaPct}%`
                      : "—",
                  ],
                ]}
                deltaIdx={2}
                deltaPos={(data.running.deltaPct ?? 0) >= 0}
              />
            </>
          )}
        </MiniCard>

        <MiniCard
          href={DEEP_LINKS.lifting}
          dot="var(--discipline-lift-dot)"
          label="Lifting · wk"
          loading={loading}
          empty={!data.lifting}
          emptyCta="Start a workout"
        >
          {data.lifting && (
            <>
              <BigNum>{data.lifting.weekTime}</BigNum>
              <Spark points={data.lifting.spark} color="var(--discipline-lift-dot)" />
              <MetaRow
                items={[
                  ["sess", String(data.lifting.sessions)],
                  ["sets", String(data.lifting.sets)],
                  ["PRs", String(data.lifting.prs)],
                ]}
                accentIdx={data.lifting.prs > 0 ? 2 : undefined}
              />
            </>
          )}
        </MiniCard>

        <MiniCard
          href={DEEP_LINKS.steps}
          label="Steps · avg"
          loading={loading}
          empty={!data.steps}
          emptyCta="Connect steps"
        >
          {data.steps && (
            <>
              <BigNum>{data.steps.avg.toLocaleString()}</BigNum>
              <Spark points={data.steps.spark} color="var(--foreground)" />
              <MetaRow
                items={[
                  ["today", compact(data.steps.today)],
                  ["goal", data.steps.goal ? compact(data.steps.goal) : "—"],
                  [
                    "att",
                    data.steps.goal
                      ? `${Math.round((data.steps.avg / data.steps.goal) * 100)}%`
                      : "—",
                  ],
                ]}
              />
            </>
          )}
        </MiniCard>

        <MiniCard
          href={DEEP_LINKS.nutrition}
          label="Nutrition · today"
          loading={loading}
          empty={!data.nutrition}
          emptyCta="Log meals"
        >
          {data.nutrition && (
            <>
              <BigNum>
                {data.nutrition.calories.toLocaleString()}
                <U>
                  {data.nutrition.calorieGoal
                    ? `/${data.nutrition.calorieGoal.toLocaleString()}`
                    : ""}{" "}
                  kcal
                </U>
              </BigNum>
              <div className="mt-2 flex gap-1.5">
                <MacroBar
                  label="P"
                  v={data.nutrition.proteinG}
                  goal={data.nutrition.proteinGoal}
                  color="var(--macro-protein)"
                />
                <MacroBar label="C" v={data.nutrition.carbsG} color="var(--macro-carb)" />
                <MacroBar label="F" v={data.nutrition.fatG} color="var(--macro-fat)" />
              </div>
              <MetaRow
                items={[
                  ["prot", `${data.nutrition.proteinG}/${data.nutrition.proteinGoal ?? "—"}g`],
                  ["carb", `${data.nutrition.carbsG}g`],
                  ["fat", `${data.nutrition.fatG}g`],
                ]}
              />
            </>
          )}
        </MiniCard>

        <MiniCard
          href={DEEP_LINKS.bodyweight}
          label="Bodyweight"
          loading={loading}
          empty={!data.bodyweight}
          emptyCta="Log weight"
        >
          {data.bodyweight && (
            <>
              <BigNum>
                {data.bodyweight.current}
                <U>{data.bodyweight.unit}</U>
              </BigNum>
              <Spark points={data.bodyweight.spark} color="var(--accent)" />
              <MetaRow
                items={[
                  [
                    "rate",
                    `${data.bodyweight.ratePerWeek > 0 ? "+" : ""}${data.bodyweight.ratePerWeek}`,
                  ],
                  ["goal", data.bodyweight.goal ? String(data.bodyweight.goal) : "—"],
                  ["unit", data.bodyweight.unit],
                ]}
                deltaIdx={0}
                deltaPos={data.bodyweight.ratePerWeek <= 0}
              />
            </>
          )}
        </MiniCard>

        <MiniCard
          href={DEEP_LINKS.streak}
          dot="var(--accent)"
          label="Streak · week"
          loading={loading}
        >
          <BigNum>
            {data.streak.weeks}
            <U>wk</U>
          </BigNum>
          <div className="mt-2.5 flex items-center gap-1">
            {WEEKDAYS.map((d, i) => (
              <span
                key={i}
                className={`grid h-5 flex-1 place-items-center rounded-sm text-[9px] font-semibold ${
                  data.streak.week[i]
                    ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                    : "bg-[var(--surface-2)] text-[var(--faint)]"
                }`}
              >
                {d}
              </span>
            ))}
          </div>
          <MetaRow
            items={[
              ["active", `${data.streak.activeDaysThisWeek}/7`],
              ["weeks", String(data.streak.weeks)],
              ["state", data.streak.weeks > 0 ? "live" : "idle"],
            ]}
          />
        </MiniCard>
      </div>
    </div>
  );
}

// --- KPI strip ------------------------------------------------------------

function Kpi({
  label,
  value,
  sub,
  delta,
  dot,
  accent,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  delta?: number | null;
  dot?: string;
  accent?: boolean;
  loading: boolean;
}) {
  return (
    <div className="border-b border-[var(--border)] px-3 py-2.5 last:border-b-0 lg:border-b-0">
      <div className="flex items-center gap-1.5">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />}
        <span
          className={`text-[10px] font-semibold uppercase tracking-wider ${accent ? "text-[var(--accent)]" : "text-[var(--faint)]"}`}
        >
          {label}
        </span>
      </div>
      {loading ? (
        <div className="mt-1.5 h-5 w-12 animate-pulse rounded bg-[var(--surface-3)]" />
      ) : (
        <p className="mt-1 font-mono text-lg font-semibold tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
          {value}
          {delta != null && (
            <span
              className={`ml-1 text-[11px] ${delta >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"}`}
            >
              {delta >= 0 ? "▲" : "▼"}
              {Math.abs(delta)}%
            </span>
          )}
        </p>
      )}
      <p className="mt-0.5 text-[10px] tabular-nums text-[var(--muted)]">{sub}</p>
    </div>
  );
}

// --- Command bar ----------------------------------------------------------

function CommandBar() {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/chat?prompt=${encodeURIComponent(value.trim())}`);
      }}
      className="mt-3 flex items-center gap-2 rounded-[var(--radius-card)] border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 font-mono transition focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent-line)]"
    >
      <span className="text-sm font-semibold text-[var(--accent)]">›</span>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="ask coach…  e.g. compare my bench to last month"
        className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--faint)] focus:outline-none"
      />
      <kbd className="hidden shrink-0 rounded border border-[var(--border-strong)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] sm:block">
        ↵
      </kbd>
    </form>
  );
}

// --- Mini-cards -----------------------------------------------------------

function MiniCard({
  href,
  dot,
  label,
  loading,
  empty,
  emptyCta,
  children,
}: {
  href: string;
  dot?: string;
  label: string;
  loading: boolean;
  empty?: boolean;
  emptyCta?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="group flex min-h-[124px] flex-col rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]"
    >
      <div className="flex items-center gap-1.5">
        {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--faint)]">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-1 flex-col">
        {loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-6 w-20 rounded bg-[var(--surface-3)]" />
            <div className="h-6 w-full rounded bg-[var(--surface-2)]" />
          </div>
        ) : empty ? (
          <div className="flex flex-1 flex-col justify-center">
            <span className="text-sm text-[var(--faint)]">—</span>
            <span className="mt-1 text-xs font-medium text-[var(--accent)]">{emptyCta} →</span>
          </div>
        ) : (
          children
        )}
      </div>
    </a>
  );
}

function BigNum({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-2xl font-semibold leading-none tabular-nums tracking-[-0.03em] text-[var(--foreground)]">
      {children}
    </p>
  );
}

function U({ children }: { children: React.ReactNode }) {
  return <span className="ml-1 text-xs font-medium text-[var(--muted)]">{children}</span>;
}

function MetaRow({
  items,
  deltaIdx,
  deltaPos,
  accentIdx,
}: {
  items: [string, string][];
  deltaIdx?: number;
  deltaPos?: boolean;
  accentIdx?: number;
}) {
  return (
    <div className="mt-auto flex items-end gap-2 pt-2.5">
      {items.map(([k, v], i) => {
        const color =
          i === deltaIdx
            ? deltaPos
              ? "text-[var(--success)]"
              : "text-[var(--danger)]"
            : i === accentIdx
              ? "text-[var(--accent)]"
              : "text-[var(--foreground)]";
        return (
          <div key={k} className="flex-1">
            <p className="text-[9px] uppercase tracking-wider text-[var(--faint)]">{k}</p>
            <p className={`font-mono text-xs font-semibold tabular-nums ${color}`}>{v}</p>
          </div>
        );
      })}
    </div>
  );
}

function MacroBar({
  label,
  v,
  goal,
  color,
}: {
  label: string;
  v: number;
  goal?: number | null;
  color: string;
}) {
  const pct = goal ? Math.min(v / goal, 1) : Math.min(v / 250, 1);
  return (
    <div className="flex-1">
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <p className="mt-0.5 text-center text-[9px] font-semibold" style={{ color }}>
        {label}
      </p>
    </div>
  );
}

function Spark({ points, color }: { points: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * (h - 3) - 1.5;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="mt-2 h-7 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
    </svg>
  );
}

/** 14000 → 14k, 1840 → 1.8k */
function compact(n: number): string {
  if (n < 1000) return String(n);
  const k = n / 1000;
  return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
}
