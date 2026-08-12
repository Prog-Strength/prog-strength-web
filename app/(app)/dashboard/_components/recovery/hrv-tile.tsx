/**
 * HrvTileCard — the `hrv_balance` tile, which is now TWO views on one card.
 *
 * "HRV Balance" and "Recovery Trend" shipped as separate tiles and were the same
 * subject twice: one athlete's HRV against one baseline, read two ways. Side by
 * side on the grid they cost two slots to say one thing, and — worse — they said
 * it from two different derivations, so the pair could genuinely disagree about
 * whether a night was balanced. They are one tile now: the balance view opens,
 * the trend view is a swipe (or an arrow key, or a dot) away, and the header
 * names whichever is showing.
 *
 * AGREEMENT is the point of the merge, and it is structural rather than
 * disciplined: `prepareHrvChart` runs ONCE here and both views render from the
 * object it returns. That single call is what makes the tile self-consistent —
 *
 *   - one guard, so the tile calibrates as a whole and never shows a finished
 *     view next to a calibrating one;
 *   - one nightly classification (`nights`), so a night is the same color in
 *     the chart and on the rail — the same green means balanced in both;
 *   - one verdict for last night (`today.status`, the balance view's dot) and
 *     one for the week (`week`, the gauge tick AND the trend view's delta), so
 *     the tile never answers the same question two ways.
 *
 * Neither view may re-derive a figure it can read off the chart object. That is
 * the rule the merge exists to enforce.
 *
 * The card is composed by hand rather than through `MiniCard` because the pager
 * is made of BUTTONS: a button inside an anchor is invalid markup and swallows
 * its own clicks, so the link wraps the header and the body only, and the pager
 * sits outside it inside the shared panel.
 *
 * Both views are always mounted; the inactive one is `invisible` and
 * `aria-hidden` rather than unmounted. It costs one extra render and buys two
 * things: the card's height is the taller view's in both states (so paging never
 * reflows the grid), and the chart's measured width is known before the user
 * ever swipes to it.
 */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { RecoveryView } from "@/lib/dashboard";
import { MiniCard, MINI_CARD_HOVER, MINI_CARD_PANEL, MiniCardTitle } from "../mini-card";
import { HrvBalanceView } from "./balance-band";
import { prepareHrvChart, type HrvChart } from "./hrv-chart";
import { MIN_BASELINE_DAYS } from "./shared";
import { RecoveryTrendView } from "./trend-rail";

/** The catalog title, and the first view's — the tile opens on HRV Balance. */
export const HRV_TILE_TITLE = "HRV Balance";

/** Horizontal travel below which a touch is a tap, not a swipe. Matches the weather tile. */
const SWIPE_THRESHOLD_PX = 40;

const VIEWS: { key: string; title: string; render: (chart: HrvChart) => React.ReactNode }[] = [
  { key: "balance", title: HRV_TILE_TITLE, render: (chart) => <HrvBalanceView chart={chart} /> },
  { key: "trend", title: "Recovery Trend", render: (chart) => <RecoveryTrendView chart={chart} /> },
];

export function HrvTileCard({ section, href }: { section: RecoveryView; href: string }) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef<number | null>(null);
  // A swipe that lands on a link still fires a click in most browsers. This
  // marks the one click that follows a swipe so it can be swallowed — paging
  // must never navigate to /recovery by accident.
  const swiped = useRef(false);

  // The one guard for the whole tile. `null` means the baseline is not
  // established yet — the honest n-of-14 progress state, with no pager, because
  // there is nothing yet to page BETWEEN.
  const chart = prepareHrvChart(section);
  if (!chart) {
    return (
      <MiniCard title={HRV_TILE_TITLE} href={href}>
        <Calibrating nights={section.baseline?.hrvDays ?? 0} />
      </MiniCard>
    );
  }

  const show = (next: number) => setActive(Math.min(VIEWS.length - 1, Math.max(0, next)));

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      show(active - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      show(active + 1);
    }
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStartX.current;
    touchStartX.current = null;
    const end = e.changedTouches[0]?.clientX;
    if (start == null || end == null) return;
    const dx = end - start;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    swiped.current = true;
    show(dx < 0 ? active + 1 : active - 1);
  }

  return (
    <div
      role="group"
      aria-label="HRV"
      className={`${MINI_CARD_PANEL} flex flex-col gap-3 ${MINI_CARD_HOVER}`}
      onKeyDown={onKeyDown}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
        swiped.current = false;
      }}
      onTouchEnd={onTouchEnd}
    >
      <Link
        href={href}
        className="flex flex-1 flex-col gap-3"
        onClick={(e) => {
          if (!swiped.current) return;
          swiped.current = false;
          e.preventDefault();
        }}
      >
        <MiniCardTitle title={VIEWS[active].title} />
        {/* Both views in ONE grid cell: the card is as tall as the taller of
            them whichever is showing, so paging never resizes the tile. */}
        <div className="grid flex-1">
          {VIEWS.map((view, i) => (
            <div
              key={view.key}
              style={{ gridArea: "1 / 1" }}
              className={i === active ? undefined : "invisible"}
              aria-hidden={i === active ? undefined : true}
              data-testid={`hrv-view-${view.key}`}
              data-active={i === active ? "true" : "false"}
            >
              {view.render(chart)}
            </div>
          ))}
        </div>
      </Link>

      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          aria-label="Previous view"
          onClick={() => show(active - 1)}
          disabled={active === 0}
          className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
        >
          ‹
        </button>
        {VIEWS.map((view, i) => (
          <button
            key={view.key}
            type="button"
            aria-label={view.title}
            aria-current={i === active ? "true" : undefined}
            onClick={() => show(i)}
            className={`h-1.5 w-1.5 rounded-full transition ${
              i === active ? "bg-[var(--foreground)]" : "bg-[var(--faint)]"
            }`}
          />
        ))}
        <button
          type="button"
          aria-label="Next view"
          onClick={() => show(active + 1)}
          disabled={active === VIEWS.length - 1}
          className="px-1 text-sm leading-none text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40 disabled:hover:text-[var(--muted)]"
        >
          ›
        </button>
      </div>
    </div>
  );
}

/** New-user state — no band to draw yet. Honest progress toward 14 nights. */
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
