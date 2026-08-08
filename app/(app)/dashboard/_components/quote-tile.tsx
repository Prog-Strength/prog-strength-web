/**
 * QuoteCard — the daily quote tile.
 *
 * The only tile with no user data behind it: the API serves it from a
 * corpus compiled into the binary, so there is no empty state, no
 * skeleton beyond the grid's, and no failure that blanks the card.
 *
 * The quote holds still for the whole local day. The reroll button is the
 * one way to change it: each tap asks the API for the next offset, which
 * walks the corpus in order and wraps, so a tap never returns the quote it
 * just replaced. Rerolling is intentionally not persisted — a reload
 * returns to the day's quote.
 *
 * Unlike its siblings this card is not a link (there is no quote page), so
 * it renders MiniCard's non-navigable variant and owns the only
 * interactive element on the grid.
 */
"use client";

import { useCallback, useState } from "react";

import { getDashboardQuote } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { QuoteView } from "@/lib/dashboard";
import { MiniCard } from "./mini-card";

export function QuoteCard({ quote }: { quote: QuoteView }) {
  // Seeded from the prop and deliberately not resynced to it. The page
  // refetches the summary after a layout edit, and re-seeding there would
  // throw away a quote the user had rerolled to. The prop only ever carries
  // the day's quote, so there is nothing newer to miss.
  const [current, setCurrent] = useState<QuoteView>(quote);
  const [loading, setLoading] = useState(false);

  const reroll = useCallback(async () => {
    const token = getToken();
    if (!token || loading) return;
    setLoading(true);
    try {
      const next = await getDashboardQuote(
        token,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        current.offset + 1,
      );
      if (next) setCurrent(next);
    } catch {
      // A failed reroll leaves the current quote in place. There is nothing
      // useful to say here — the tile is decorative, and an error banner on
      // a motivational quote would be worse than the button doing nothing.
    } finally {
      setLoading(false);
    }
  }, [current.offset, loading]);

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
            {current.author}
            {current.source && (
              <span className="block text-[var(--muted)] opacity-70">{current.source}</span>
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
