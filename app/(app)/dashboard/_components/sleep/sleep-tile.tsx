/**
 * The `sleep` tile. It answers two questions and prints no number another tile
 * already heroes:
 *
 *   1. DID YOU GET ENOUGH? — the headline asleep duration (in bed minus awake
 *      minus no-data) against WHOOP's computed need, with the sleep performance
 *      percentage as the qualifier. This is the figure the user asked for and
 *      no existing tile shows.
 *   2. WHAT KIND OF SLEEP WAS IT? — one stacked stage bar plus a compact legend
 *      (see `stage-bar.tsx` for why a part-to-whole mark is the right one).
 *
 * Two components live here on purpose. `SleepCard` is pure and takes a
 * `SleepView`, so every rendering case is testable without a network. `SleepTile`
 * is the thin wrapper the renderer mounts: it reads the Whoop connection the
 * same way the Settings row does, because `DashboardData` carries no connection
 * state and `tile-renderer.tsx` is a pure switch that should stay one.
 *
 * The three states and their ORDER:
 *
 *   - CONNECTED BUT UNDER-SCOPED → the reconnect affordance, checked FIRST. An
 *     under-scoped connection is connected, so its section is present — it is
 *     simply empty forever until the user re-consents. Testing `present` first
 *     would render the ordinary empty state and leave the user waiting for data
 *     that is never coming.
 *   - CONNECTED AND SCOPED, NO DATA YET → the tile's own empty state, the same
 *     calm muted CTA `connect-card.tsx` uses. Never an error.
 *   - NO CONNECTION → no tile. The section is absent only for a user with no
 *     connection at all, and the recovery family already owns the connect
 *     invitation; an empty grid slot beats a second one.
 */
"use client";

import { useEffect, useState } from "react";
import type { DashboardData, SleepView } from "@/lib/dashboard";
import { getWhoopConnection } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { BigNum } from "../big-num";
import { MiniCard, MiniCardEmpty } from "../mini-card";
import { SETTINGS_INTEGRATIONS_HREF, SleepReconnectCard } from "./reconnect-card";
import { StageBar } from "./stage-bar";
import {
  STAGE_ORDER,
  asleepMilli,
  formatSleepDuration,
  sleepNeedMilli,
  stageColor,
  stageLabel,
} from "./shared";

const TITLE = "Sleep";

export function SleepTile({ section, href }: { section: DashboardData["sleep"]; href: string }) {
  const underScoped = useWhoopUnderScoped();
  if (underScoped) return <SleepReconnectCard href={SETTINGS_INTEGRATIONS_HREF} />;
  if (!section.present) return null;
  return <SleepCard section={section} href={href} />;
}

/**
 * Whether the Whoop connection is connected but missing a scope ingestion
 * needs. A REFINEMENT of `connected`, never a fourth status — the API keeps
 * capability off the lifecycle enum on purpose, so `error` is left to Settings,
 * which owns that copy.
 *
 * Defaults to false and stays false on a failed read, matching the Settings
 * row's own safe default: a failed connection read must never hide real data
 * behind a reconnect prompt. For the same reason the in-flight state renders
 * the tile rather than a skeleton — a night the user already has should not
 * wait on a second request to appear.
 */
function useWhoopUnderScoped(): boolean {
  const [underScoped, setUnderScoped] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const conn = await getWhoopConnection(token);
        if (cancelled) return;
        setUnderScoped(conn.status === "connected" && (conn.missing_scopes?.length ?? 0) > 0);
      } catch {
        // Leave it false: see the note above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return underScoped;
}

export function SleepCard({ section, href }: { section: SleepView; href: string }) {
  const night = section.lastNight;
  if (!night) {
    return (
      <MiniCard title={TITLE} href={href}>
        <MiniCardEmpty cta="Wear your Whoop overnight to see sleep" />
      </MiniCard>
    );
  }

  const asleep = asleepMilli(night);
  const need = sleepNeedMilli(night);

  return (
    <MiniCard title={TITLE} href={href}>
      <div className="flex items-baseline justify-between gap-2">
        {/* The hero: how much sleep, against how much was needed. The need is
            WHOOP's own figure — Prog Strength derives no sleep model. */}
        <BigNum
          value={formatSleepDuration(asleep)}
          suffix={need !== null ? `asleep of ${formatSleepDuration(need)} need` : "asleep"}
        />
        <div className="shrink-0 text-right">
          <div className="font-mono text-sm tabular-nums text-[var(--foreground)]">
            {night.performancePct !== null ? `${Math.round(night.performancePct)}%` : "—"}
          </div>
          <div className="text-[10px] text-[var(--muted)]">performance</div>
        </div>
      </div>
      <StageBar night={night} />
      <Legend />
    </MiniCard>
  );
}

/**
 * The ramp's key. All four stages always print, including one the night is
 * missing: this is a legend for the encoding, not a second copy of the data,
 * and a key whose entries appear and disappear is a key nobody learns.
 */
function Legend() {
  return (
    <div className="-mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--faint)]">
      {STAGE_ORDER.map((stage) => (
        <span key={stage} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 rounded-[1px]"
            style={{ backgroundColor: stageColor(stage) }}
          />
          {stageLabel(stage)}
        </span>
      ))}
    </div>
  );
}
