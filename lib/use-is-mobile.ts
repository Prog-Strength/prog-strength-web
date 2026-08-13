"use client";

/**
 * `useIsMobile` — one subscription to the viewport question every responsive
 * component on this app asks: *am I narrower than Tailwind's `sm:` breakpoint?*
 *
 * The query is `(max-width: 639px)` and the number is not a taste: `sm:` is
 * 640px, so 639 is the last pixel BELOW it. A component that picks a plot height
 * in JS and a grid collapse in CSS therefore switches both on the same pixel,
 * and never spends a frame with a mobile layout at desktop heights. Measuring a
 * width and comparing it to a constant would be a second definition of the same
 * breakpoint, free to drift from the first.
 *
 * `useSyncExternalStore` rather than an effect that snapshots `matchMedia` into
 * state: subscribing to the media query's own `change` event is what the store
 * API is for, and it avoids the set-state-in-effect pattern the repo's React 19
 * hook rules flag. The three functions are at module scope so React gets stable
 * references and does not re-subscribe on every render. The server snapshot is
 * `false` — SSR renders the desktop layout, the most common case, and a mobile
 * viewport re-renders to the true value on hydration.
 *
 * THE TWO PRE-EXISTING INLINE COPIES ARE LEFT ALONE. `components/date-tile-strip.tsx`
 * and `app/(app)/bodyweight/page.tsx` each carry this same plumbing privately,
 * and the second of them says a third consumer should extract a shared hook —
 * which is what this file is. Folding those two in is a follow-up: it touches
 * two unrelated surfaces and their tests, and this change is scoped to
 * `/recovery`. New consumers import from here.
 */

import { useSyncExternalStore } from "react";

/** Tailwind's `sm:` breakpoint is 640px, so mobile is everything up to 639. */
const MOBILE_QUERY = "(max-width: 639px)";

function subscribeMobileQuery(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches;
}

function getMobileServerSnapshot(): boolean {
  // SSR default: desktop. There is no viewport to ask on the server, and
  // guessing mobile would flash the wide layout at every desktop user instead.
  return false;
}

/** True while the viewport is narrower than Tailwind's `sm:` breakpoint. */
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeMobileQuery, getMobileSnapshot, getMobileServerSnapshot);
}
