/**
 * RecoveryCard — the dashboard's Whoop-sourced recovery mini-card.
 *
 * Rendered ONLY for a connected user (the page gates on
 * `data.recovery.present`); an unconnected user sees no card at all — there
 * is no empty CTA variant here, unlike the log-your-X domain cards. Mirrors
 * StepsCard's grammar: a BigNum headline (today's resting HR, "bpm"), a Spark
 * of the recent resting-HR trend, and a MetaRow secondary (recovery score).
 *
 * Design note: resting HR is a DATA metric, so the spark stroke is a calm
 * `--muted` — never the periwinkle `--accent` (app chrome / selection only)
 * and never a discipline hue (recovery is not run/lift). When Whoop has no
 * reading yet today the headline degrades to a muted "no data yet today"
 * while the card stays present (the user is still connected).
 */

import type { RecoveryView } from "@/lib/dashboard";
import { compact } from "./compact";
import { BigNum } from "./big-num";
import { MetaRow } from "./meta-row";
import { MiniCard, MiniCardEmpty } from "./mini-card";
import { Spark } from "./spark";

export function RecoveryCard({ section, href }: { section: RecoveryView; href: string }) {
  const v = section;
  return (
    <MiniCard title="Recovery" href={href}>
      {v.restingToday !== null ? (
        <BigNum value={compact(v.restingToday)} suffix="bpm resting" />
      ) : (
        <BigNum value="—" suffix="no data yet today" />
      )}
      {/* Resting HR is a metric, not app chrome — a calm --muted stroke, never --accent. */}
      <Spark points={v.spark} className="h-7 w-full text-[var(--muted)]" />
      <MetaRow
        items={[
          {
            label: "recovery",
            value: v.recoveryScore !== null ? compact(v.recoveryScore) : "—",
          },
        ]}
      />
    </MiniCard>
  );
}

/**
 * RecoveryCardEmpty — the `present: false` variant of the recovery tile.
 *
 * Unlike the always-connected `RecoveryCard`, this renders when recovery is
 * deliberately enabled on the layout but no Whoop reading is available (an
 * unconnected user). It mirrors the log-your-X domain cards' empty grammar:
 * a MiniCard wrapping an inviting CTA that links into the integrations page.
 */
export function RecoveryCardEmpty({ href }: { href: string }) {
  return (
    <MiniCard title="Recovery" href={href}>
      <MiniCardEmpty cta="Connect Whoop to see recovery" />
    </MiniCard>
  );
}
