/**
 * Typefaces for the timeline DX variants. Type scale is a load-bearing axis
 * of this exploration, so each idiom gets a genuinely distinct face rather
 * than a re-weighted Geist. Scoped to /design-explore — never imported by
 * production surfaces. Disposable, like the rest of this route.
 */
import { Fraunces, Oswald, JetBrains_Mono, Nunito } from "next/font/google";

/** editorial-milestone-journal — a high-contrast display serif (magazine). */
export const editorialDisplay = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

/** strava-social-dashboard — a condensed athletic sans for loud titles. */
export const athleticCondensed = Oswald({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** terminal-activity-ledger — a uniform monospace for the log idiom. */
export const ledgerMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

/** soft-coaching-community — a rounded, comfortable sans. */
export const softRounded = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  display: "swap",
});
