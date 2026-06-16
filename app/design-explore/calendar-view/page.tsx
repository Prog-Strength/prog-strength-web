/**
 * Design Exploration — calendar-view comparison route.
 *
 * Throwaway surface: renders all 5 calendar idioms on one screen, each
 * clearly labeled, so a human can compare directions and pick one. This is
 * NOT production code — it is gated behind `config.designExploreEnabled`
 * (NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE=true) and 404s otherwise, so it is
 * dead in production and unreachable from normal navigation. The winning
 * variant gets reimplemented properly by a downstream SOW.
 *
 * See dx/calendar-view.md for the idiom briefs. Each variant lives in
 * ./_variants and is fully self-contained — duplication between variants is
 * intentional; divergence, not shared abstraction, is the point.
 */
import { notFound } from "next/navigation";
import {
  Fraunces,
  Hanken_Grotesk,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  JetBrains_Mono,
  Libre_Franklin,
  Nunito,
} from "next/font/google";
import { config } from "@/lib/config";

import StravaAiryMinimal from "./_variants/strava-airy-minimal";
import GarminDataDense from "./_variants/garmin-data-dense";
import EditorialDataJournalism from "./_variants/editorial-data-journalism";
import TerminalDenseMono from "./_variants/terminal-dense-mono";
import WarmOrganicCoaching from "./_variants/warm-organic-coaching";

// Each idiom leans on a distinct typeface so the variants diverge on type,
// not just accent color. Loaded here at module scope (next/font requirement)
// and exposed as CSS variables applied to the page root.
const hanken = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-hanken" });
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-mono",
});
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const franklin = Libre_Franklin({ subsets: ["latin"], variable: "--font-franklin" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

const VARIANTS = [
  { id: "strava-airy-minimal", label: "Strava · Airy Minimal", Component: StravaAiryMinimal },
  { id: "garmin-data-dense", label: "Garmin · Data Dense", Component: GarminDataDense },
  {
    id: "editorial-data-journalism",
    label: "Editorial · Data Journalism",
    Component: EditorialDataJournalism,
  },
  { id: "terminal-dense-mono", label: "Terminal · Dense Mono", Component: TerminalDenseMono },
  { id: "warm-organic-coaching", label: "Warm · Organic Coaching", Component: WarmOrganicCoaching },
] as const;

const fontVars = [
  hanken.variable,
  plex.variable,
  plexMono.variable,
  fraunces.variable,
  franklin.variable,
  jetbrains.variable,
  nunito.variable,
].join(" ");

export default function CalendarViewDesignExplore() {
  // Hard gate: dead in production, unreachable unless the env flag is set.
  if (!config.designExploreEnabled) notFound();

  return (
    <div className={`${fontVars} min-h-screen bg-[#101012] text-white`}>
      {/* Sticky exploration toolbar — clearly marks this as a non-product, */}
      {/* throwaway comparison surface and lets the reviewer jump between idioms. */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#101012]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-2 px-6 py-3">
          <span className="grid h-6 w-6 place-items-center rounded bg-white text-[13px] font-black text-[#101012]">
            P
          </span>
          <div className="mr-2">
            <div className="text-[13px] font-semibold leading-none">
              Design Exploration · calendar-view
            </div>
            <div className="mt-0.5 text-[11px] leading-none text-white/40">
              5 variants — pick a direction, then close this PR (do not merge)
            </div>
          </div>
          <span className="rounded bg-amber-400/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
            DO NOT MERGE
          </span>
          <nav className="ml-auto flex flex-wrap gap-1.5">
            {VARIANTS.map((v, i) => (
              <a
                key={v.id}
                href={`#${v.id}`}
                className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-medium text-white/70 transition hover:border-white/40 hover:text-white"
              >
                {i + 1}. {v.label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">
        <p className="mb-6 max-w-[760px] px-2 text-[13px] leading-relaxed text-white/50">
          The same monthly training calendar (June 2026 fixture — a completed first half, a planned
          second half, a dense day on Jun 16, a recovery week, and empty stretches) rendered five
          ways. Each variant realizes a distinct idiom along <em>type scale</em>,{" "}
          <em>color logic</em>, and <em>spacing rhythm</em> — not merely a swapped accent. Compare,
          then pick one.
        </p>

        <div className="flex flex-col gap-10">
          {VARIANTS.map((v, i) => (
            <section key={v.id} id={v.id} className="scroll-mt-20">
              {/* Variant label band */}
              <div className="mb-3 flex items-center gap-3 px-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <div>
                  <h2 className="text-[15px] font-semibold leading-none">{v.label}</h2>
                  <code className="text-[11px] text-white/40">{v.id}</code>
                </div>
              </div>
              {/* The variant itself, framed so each idiom's own canvas/theme is */}
              {/* visible against the neutral comparison shell. */}
              <div className="overflow-hidden rounded-xl border border-white/10 shadow-2xl">
                <v.Component />
              </div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-white/10 px-2 py-6 text-[12px] text-white/40">
          Disposable exploration on a throwaway branch (<code>dx/calendar-view</code>). Never
          merged; the chosen variant is reimplemented by a downstream SOW.
        </footer>
      </main>
    </div>
  );
}
