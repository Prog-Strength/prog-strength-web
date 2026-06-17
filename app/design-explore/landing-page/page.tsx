import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { CenteredHeroSpotlight } from "./_variants/CenteredHeroSpotlight";
import { SplitScreenProduct } from "./_variants/SplitScreenProduct";
import { AthleticDisplayBold } from "./_variants/AthleticDisplayBold";
import { FeatureShowcaseStack } from "./_variants/FeatureShowcaseStack";
import { ConversationLed } from "./_variants/ConversationLed";

/**
 * Design Exploration comparison route — landing-page.
 *
 * THROWAWAY. Renders all five landing-page variants on a single screen so a
 * human can compare directions and pick one. Never merged; the chosen
 * variant is reimplemented by a downstream SOW (see dx/landing-page.md).
 *
 * Feature-gated: this route 404s unless NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE
 * === "true" (read via lib/config.ts, the repo's only runtime-config
 * pattern). It is unset in production, so the route is dead there and
 * unreachable from normal product navigation — purely additive.
 */

const variants = [
  {
    idiom: "centered-hero-spotlight",
    reference: "Linear",
    Component: CenteredHeroSpotlight,
  },
  {
    idiom: "split-screen-product",
    reference: "Vercel / Stripe",
    Component: SplitScreenProduct,
  },
  {
    idiom: "athletic-display-bold",
    reference: "Whoop",
    Component: AthleticDisplayBold,
  },
  {
    idiom: "feature-showcase-stack",
    reference: "Notion",
    Component: FeatureShowcaseStack,
  },
  {
    idiom: "conversation-led",
    reference: "ChatGPT",
    Component: ConversationLed,
  },
];

export default function LandingPageDesignExplore() {
  if (!config.designExploreEnabled) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[var(--background)]">
      {/* Comparison chrome — not part of any variant; only here to label and
          navigate between the five mockups. */}
      <header className="sticky top-0 z-50 border-b border-[var(--border-strong)] bg-[var(--background)]/90 px-5 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">
            DX · landing-page
          </span>
          <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--accent)]">
            5 variants · compare &amp; pick
          </span>
          <nav className="flex flex-wrap items-center gap-1.5 text-xs">
            {variants.map((v, i) => (
              <a
                key={v.idiom}
                href={`#${v.idiom}`}
                className="rounded-full border border-[var(--border)] px-2.5 py-1 font-medium text-[var(--muted)] transition hover:border-[var(--accent-line)] hover:text-[var(--foreground)]"
              >
                {i + 1}. {v.idiom}
              </a>
            ))}
          </nav>
        </div>
      </header>

      {variants.map((v, i) => {
        const { Component } = v;
        return (
          <section
            key={v.idiom}
            id={v.idiom}
            className="scroll-mt-16 border-b border-[var(--border-strong)]"
          >
            {/* Per-variant label band */}
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 bg-[var(--surface)] px-5 py-2.5">
              <span className="text-xs font-bold tabular-nums text-[var(--accent)]">
                Variant {i + 1} / 5
              </span>
              <span className="text-sm font-bold tracking-tight text-[var(--foreground)]">
                {v.idiom}
              </span>
              <span className="text-xs text-[var(--faint)]">draws on {v.reference}</span>
            </div>
            <Component />
          </section>
        );
      })}
    </main>
  );
}
