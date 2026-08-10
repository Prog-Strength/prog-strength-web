/**
 * QuoteCard — the daily quote tile.
 *
 * The only tile with no user data behind it: the API serves it from a
 * corpus compiled into the binary, so there is no empty state, no
 * skeleton beyond the grid's, and no failure that blanks the card.
 *
 * The quote holds still for the whole local day. The reroll button is the
 * one way to change it: each tap asks the API to advance, which walks the
 * corpus in order and wraps, so a tap never returns the quote it just
 * replaced. The server persists the position for the local day, so a
 * rerolled quote survives a reload and lapses back to the day's quote at
 * local midnight.
 *
 * Unlike its siblings this card is not a link (there is no quote page), so
 * it renders MiniCard's non-navigable variant. The attribution beneath the
 * quote links out to Wikipedia when the corpus has an article for the
 * author or the work — see Attribution below.
 */
"use client";

import { useCallback, useState } from "react";

import { rerollDashboardQuote } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { adaptQuote, type QuoteView } from "@/lib/dashboard";
import { MiniCard } from "./mini-card";

/**
 * One half of the attribution — the author or the work — linked to its
 * Wikipedia article when the corpus has one and rendered as plain text
 * when it doesn't. Both halves decide independently: a quote can easily
 * have an author with an article and a source without one.
 *
 * The link opens in a new tab. The dashboard is what the user came for,
 * and navigating the whole app away to read about Camus is the worse
 * outcome; `rel` keeps the new tab from reaching back through
 * `window.opener`. A plain <a> rather than next/link because the
 * destination is off-site — there is nothing for the router to prefetch.
 */
function Attribution({ label, href }: { label: string; href?: string }) {
  if (!href) return <>{label}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline decoration-dotted underline-offset-2 transition hover:text-[var(--accent)]"
    >
      {label}
    </a>
  );
}

export function QuoteCard({ quote }: { quote: QuoteView }) {
  // Seeded from the prop and deliberately not resynced to it. The page
  // refetches the summary after a layout edit; re-seeding there would be
  // harmless now that the server persists the reroll (the prop carries the
  // same quote this state holds), but it would still briefly re-render the
  // tile for a change that has nothing to do with it.
  const [current, setCurrent] = useState<QuoteView>(quote);
  const [loading, setLoading] = useState(false);

  // No offset is tracked or sent. The server holds the position and
  // advances it, so two open tabs cannot each advance from their own stale
  // idea of where the user is.
  const reroll = useCallback(async () => {
    const token = getToken();
    if (!token || loading) return;
    setLoading(true);
    try {
      const next = await rerollDashboardQuote(
        token,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      // adaptQuote, not the raw response. The reroll endpoint returns the
      // same snake_case shape the summary does, and the prop this state was
      // seeded from arrived already adapted — so the wire object has to be
      // converted before it can replace it. Assigning it directly type-checks
      // (every renamed field is optional on QuoteView, and excess-property
      // checks don't apply to a variable), and the attribution silently
      // stops being a link until the next page load.
      if (next) setCurrent(adaptQuote(next));
    } catch {
      // A failed reroll leaves the current quote in place. There is nothing
      // useful to say here — the tile is decorative, and an error banner on
      // a motivational quote would be worse than the button doing nothing.
    } finally {
      setLoading(false);
    }
  }, [loading]);

  return (
    <MiniCard title="Daily Quote">
      <div className="flex flex-1 flex-col justify-between gap-3">
        {/* polite, not assertive: a rerolled quote should be announced after
            the current utterance, never interrupt it. */}
        <blockquote aria-live="polite" className="text-sm leading-relaxed text-[var(--fg)]">
          &ldquo;{current.text}&rdquo;
        </blockquote>
        <div className="flex items-end justify-between gap-3">
          <cite className="not-italic text-xs text-[var(--muted)]">
            <Attribution label={current.author} href={current.authorUrl} />
            {current.source && (
              <span className="block text-[var(--muted)] opacity-70">
                <Attribution label={current.source} href={current.sourceUrl} />
              </span>
            )}
          </cite>
          <button
            type="button"
            onClick={reroll}
            disabled={loading}
            aria-label="Show another quote"
            className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--accent)] disabled:opacity-50"
          >
            {loading ? "…" : "New quote"}
          </button>
        </div>
      </div>
    </MiniCard>
  );
}
