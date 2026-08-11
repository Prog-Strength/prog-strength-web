/**
 * The `sleep` tile. It answers two questions and prints no number another tile
 * already heroes:
 *
 *   1. DID YOU GET ENOUGH? — the headline asleep duration (in bed minus awake
 *      minus no-data) against WHOOP's computed need, with the sleep performance
 *      percentage as the qualifier. This is the figure the user asked for and
 *      no existing tile shows.
 *   2. WHAT KIND OF SLEEP WAS IT? — one stacked stage bar plus a compact legend
 *      that names AND times every stage (see `stage-bar.tsx` for why a
 *      part-to-whole mark is the right one, and `Legend` below for why the
 *      durations are printed rather than left on the bar's hover).
 *
 * Two components live here on purpose. `SleepCard` is pure and takes a
 * `SleepView`, so every rendering case is testable without a network. `SleepTile`
 * is the thin wrapper the renderer mounts: it reads the Whoop connection the
 * same way the Settings row does, because `DashboardData` carries no connection
 * state and `tile-renderer.tsx` is a pure switch that should stay one.
 *
 * The three states and their ORDER:
 *
 *   - CONNECTED BUT MISSING THE SLEEP SCOPE → the reconnect affordance, checked
 *     FIRST. Such a connection is connected, so its section is present — it is
 *     simply empty forever until the user re-consents. Testing `present` first
 *     would render the ordinary empty state and leave the user waiting for data
 *     that is never coming. The test is for THAT scope by name: a connection
 *     missing some unrelated scope ingests sleep fine, and this branch must
 *     never stand in front of a night the user actually has.
 *   - CONNECTED AND SCOPED, NO DATA YET → the tile's own empty state, the same
 *     calm muted CTA `connect-card.tsx` uses. Never an error.
 *   - NO CONNECTION → no tile. The section is absent only for a user with no
 *     connection at all, and the recovery family already owns the connect
 *     invitation; an empty grid slot beats a second one.
 */
"use client";

import { useEffect, useState } from "react";
import type { DashboardData, SleepNightView, SleepView } from "@/lib/dashboard";
import { getWhoopConnection } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { missingSleepScope } from "@/lib/whoop";
import { BigNum } from "../big-num";
import { MiniCard, MiniCardEmpty } from "../mini-card";
import { SleepReconnectCard } from "./reconnect-card";
import { StageBar } from "./stage-bar";
import {
  STAGE_ORDER,
  asleepMilli,
  formatSleepDuration,
  formatSleepPercent,
  sleepNeedMilli,
  stageColor,
  stageLabel,
  stageMilli,
} from "./shared";

const TITLE = "Sleep";

export function SleepTile({ section, href }: { section: DashboardData["sleep"]; href: string }) {
  const sleepUnscoped = useSleepScopeMissing();
  if (sleepUnscoped) return <SleepReconnectCard />;
  if (!section.present) return null;
  return <SleepCard section={section} href={href} />;
}

/**
 * Whether the Whoop connection is connected but never consented to the SLEEP
 * scope specifically (`missingSleepScope`, not "any missing scope" — a
 * connection missing only, say, the workout scope ingests sleep perfectly, and
 * asking the broader question would replace that user's real night with a
 * prompt to enable tracking they already have).
 *
 * A REFINEMENT of `connected`, never a fourth status — the API keeps capability
 * off the lifecycle enum on purpose, so `error` is left to Settings, which owns
 * that copy.
 *
 * Defaults to false and stays false on a failed read, matching the Settings
 * row's own safe default: a failed connection read must never hide real data
 * behind a reconnect prompt. For the same reason the in-flight state renders
 * the tile rather than a skeleton — a night the user already has should not
 * wait on a second request to appear.
 */
function useSleepScopeMissing(): boolean {
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const conn = await getWhoopConnection(token);
        if (cancelled) return;
        setMissing(missingSleepScope(conn));
      } catch {
        // Leave it false: see the note above.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return missing;
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
            {formatSleepPercent(night.performancePct)}
          </div>
          <div className="text-[10px] text-[var(--muted)]">performance</div>
        </div>
      </div>
      <StageBar night={night} />
      <Legend night={night} />
    </MiniCard>
  );
}

/**
 * The ramp's key, and the night's stage durations.
 *
 * All four stages always print, including one the night is missing (which reads
 * as an em dash): a key whose entries appear and disappear is a key nobody
 * learns, and an absent stage is a fact worth showing rather than a row that
 * silently vanishes.
 *
 * THE DURATIONS LIVE HERE, not only on the bar. The bar's segments carry a
 * `title` for the pointer, but a `title` is a pointer affordance and nothing
 * else — a keyboard-only sighted user never sees one. The alternative, making
 * each segment focusable, spends four tab stops inside the tile's own link on
 * which Enter does nothing. Printing the durations in the legend costs no tab
 * stop, is visible to every user regardless of input device, and removes the
 * hover/focus asymmetry the SOW's "durations on hover/focus" asks about rather
 * than papering over it.
 *
 * Two columns rather than one wrapping row: four `Deep 1h 32m` items are wider
 * than the tile at every grid breakpoint but the widest, so a single row would
 * wrap 3-and-1 and read ragged. A 2×2 key wraps by construction, and the
 * durations align in their two columns.
 *
 * `formatSleepDuration` is the bar's own formatter — a second copy is how the
 * legend and the bar's tooltip start disagreeing about the same minute.
 */
function Legend({ night }: { night: SleepNightView }) {
  return (
    <div className="-mb-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[var(--faint)]">
      {STAGE_ORDER.map((stage) => (
        <span key={stage} data-stage-legend={stage} className="flex items-center gap-1">
          <span
            aria-hidden="true"
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-[1px]"
            style={{ backgroundColor: stageColor(stage) }}
          />
          <span>{stageLabel(stage)}</span>
          <span className="ml-auto font-mono tabular-nums text-[var(--muted)]">
            {formatSleepDuration(stageMilli(night, stage))}
          </span>
        </span>
      ))}
    </div>
  );
}
