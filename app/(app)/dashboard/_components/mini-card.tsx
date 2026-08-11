/**
 * MiniCard — a dense per-domain card on the command-center grid.
 *
 * The whole card is a `next/link` into a deep page (`href`), wrapping a
 * headline (BigNum), a Spark, and a MetaRow (the nutrition card swaps the
 * spark for MacroBars). Three variants:
 *   - default: live data, hairline panel, hover lift
 *   - empty:   `present: false` — an inviting muted CTA into the deep page
 *   - skeleton: the loading placeholder shown while the single fetch is in
 *     flight (a non-interactive shimmer, not a page spinner)
 *
 * Radius is `--radius-card` (14px); the panel border is the `--border`
 * hairline. Kept presentational — the page composes the children.
 */

import Link from "next/link";
import type { ReactNode } from "react";

const PANEL = "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4";

/**
 * The panel and its navigable-hover treatment, for the one card that cannot use
 * `MiniCard` itself: a tile with its own BUTTONS inside (the HRV tile's pager)
 * can't be wrapped in a single `<a>`, since a button inside an anchor is invalid
 * markup and swallows its own clicks. Such a card composes the panel by hand and
 * links only its body. Exported so it still looks like every other tile — a
 * second hand-written panel string is how the grid starts drifting apart.
 */
export const MINI_CARD_PANEL = PANEL;
export const MINI_CARD_HOVER =
  "transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]";

/** The card heading, in the house style. */
export function MiniCardTitle({ title }: { title: string }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{title}</h3>
  );
}

/** Loading placeholder — same footprint as a populated card. */
export function MiniCardSkeleton() {
  return (
    <div className={`${PANEL} flex animate-pulse flex-col gap-3`} aria-hidden="true">
      <div className="h-3 w-20 rounded bg-[var(--surface-2)]" />
      <div className="h-7 w-24 rounded bg-[var(--surface-2)]" />
      <div className="h-7 w-full rounded bg-[var(--surface-2)]" />
      <div className="h-3 w-32 rounded bg-[var(--surface-2)]" />
    </div>
  );
}

export function MiniCard({
  title,
  href,
  icon,
  children,
}: {
  title: string;
  /**
   * Deep page for this card. Omitted by tiles with no page behind them
   * (the quote tile), which render the same panel as a plain container —
   * no link, and no hover lift, since nothing happens on click.
   */
  href?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const header = (
    <div className="flex items-center gap-1.5">
      {icon && <span className="text-[var(--muted)]">{icon}</span>}
      <MiniCardTitle title={title} />
    </div>
  );

  if (!href) {
    return (
      <div className={`${PANEL} flex flex-col gap-3`}>
        {header}
        {children}
      </div>
    );
  }

  return (
    <Link href={href} className={`${PANEL} group flex flex-col gap-3 ${MINI_CARD_HOVER}`}>
      {header}
      {children}
    </Link>
  );
}

/**
 * Empty-state body for a `present: false` domain card — an inviting CTA
 * styled muted so it reads as a calm prompt, not an error. Rendered as the
 * child of MiniCard so the whole card still links into the deep page.
 */
export function MiniCardEmpty({ cta }: { cta: string }) {
  return (
    <div className="flex flex-1 items-center">
      <p className="text-sm text-[var(--muted)]">
        {cta} <span className="text-[var(--accent)]">→</span>
      </p>
    </div>
  );
}
