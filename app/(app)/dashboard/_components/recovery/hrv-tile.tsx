/**
 * HrvTileCard — the `hrv_balance` tile.
 *
 * HISTORY, because the shape of this file only makes sense with it. "HRV
 * Balance" and "Recovery Trend" shipped as separate tiles, were merged into two
 * paged views of this one card (they were the same subject twice, and being
 * separate let them genuinely disagree), and the trend view has now been
 * removed outright. What the merge established survives the removal: there is
 * ONE derivation behind the card, and the balance view is it.
 *
 * `prepareHrvChart` still runs once and still guards the whole tile, which is
 * now simply how a tile is written rather than a mechanism holding two views in
 * agreement. The rules it enforced are unchanged for the surviving view:
 *
 *   - one guard, so the tile calibrates as a whole;
 *   - one verdict for last night (`today.status`, the balance view's dot) and
 *     one for the week (`week`, the gauge tick), so the tile never answers the
 *     same question two ways.
 *
 * The view may not re-derive a figure it can read off the chart object.
 *
 * There is no pager, so there are no buttons, so the card is a plain `MiniCard`
 * again — the hand-composed panel existed only because a button inside an
 * anchor is invalid markup and swallows its own clicks. Adding a second view
 * back means restoring all of that; the git history has it.
 */
"use client";

import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard } from "../mini-card";
import { HrvBalanceView } from "./balance-band";
import { prepareHrvChart } from "./hrv-chart";
import { MIN_BASELINE_DAYS } from "./shared";

/** The catalog title, and the card's — there is one view. */
export const HRV_TILE_TITLE = "HRV Balance";

export function HrvTileCard({ section, href }: { section: RecoveryView; href: string }) {
  // The one guard for the whole tile. `null` means the baseline is not
  // established yet — the honest n-of-N progress state.
  const chart = prepareHrvChart(section);

  return (
    <MiniCard title={HRV_TILE_TITLE} href={href}>
      {chart ? (
        <HrvBalanceView chart={chart} />
      ) : (
        <Calibrating nights={section.baseline?.hrvDays ?? 0} />
      )}
    </MiniCard>
  );
}

/** New-user state — no band to draw yet. Honest progress toward the calibration floor. */
function Calibrating({ nights }: { nights: number }) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <span className="text-sm font-medium text-[var(--muted)]">Calibrating your band</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-[var(--accent)]"
          style={{ width: `${Math.min(100, (nights / MIN_BASELINE_DAYS) * 100)}%` }}
        />
      </div>
      <p className="text-[11px] text-[var(--faint)]">
        <span className="font-mono tabular-nums text-[var(--muted)]">
          {nights} of {MIN_BASELINE_DAYS}
        </span>{" "}
        nights · your normal range appears once Whoop knows your spread
      </p>
    </div>
  );
}
