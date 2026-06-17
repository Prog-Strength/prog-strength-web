import { notFound } from "next/navigation";
import { config } from "@/lib/config";
import { LinearMinimal } from "./_components/variant-linear-minimal";
import { GroupedSavebar } from "./_components/variant-grouped-savebar";
import { TwoPaneNav } from "./_components/variant-two-pane-nav";
import { AthleticIdentity } from "./_components/variant-athletic-identity";
import { ConversationalInline } from "./_components/variant-conversational-inline";

/**
 * Settings Design Exploration (DX) — comparison route.
 *
 * Renders all five settings variants on one screen, side by side, each
 * labeled with its idiom, so a human can compare directions and pick one.
 * This is a THROWAWAY exploration: it never merges, ships no production
 * code, and is reachable only when the NEXT_PUBLIC_DESIGN_EXPLORE flag is
 * on (off everywhere by default → notFound, so it is dead in production).
 *
 * Each variant under _components/ is self-contained and duplicative on
 * purpose — divergence is the goal, not shared abstraction. See
 * dx/settings.md for the idiom grounding.
 */

const VARIANTS = [
  {
    id: "linear-minimal",
    title: "linear-minimal",
    draws: "Linear",
    note: "Boxless hairline rows · auto-save on blur · near-monochrome, violet only on focus.",
    Component: LinearMinimal,
  },
  {
    id: "grouped-savebar",
    title: "grouped-savebar",
    draws: "Vercel / GitHub",
    note: "Sectioned cards · one sticky “Save changes” bar with a dirty count · violet on the bar only.",
    Component: GroupedSavebar,
  },
  {
    id: "two-pane-nav",
    title: "two-pane-nav",
    draws: "Stripe / Notion",
    note: "Left rail + detail pane · per-control instant auto-save · top tab strip on narrow.",
    Component: TwoPaneNav,
  },
  {
    id: "athletic-identity",
    title: "athletic-identity",
    draws: "Whoop",
    note: "Hero identity card (Oswald display) · allowance ring · per-section Edit mode.",
    Component: AthleticIdentity,
  },
  {
    id: "conversational-inline",
    title: "conversational-inline",
    draws: "Notion / ChatGPT",
    note: "Plain-language prose · click a bold value to edit in place · violet marks what’s editable.",
    Component: ConversationalInline,
  },
] as const;

export default function SettingsDesignExplorePage() {
  if (!config.designExplore) notFound();

  return (
    <main className="flex flex-1 flex-col overflow-hidden">
      <header className="border-b border-[var(--border)] px-6 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-lg font-semibold tracking-tight">Settings — Design Exploration</h1>
          <span className="rounded-full bg-[var(--warning)]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--warning)]">
            DX · do not merge
          </span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Five differentiated directions for the settings surface, side by side. Pick one — this
          route never ships.
        </p>
        <nav className="mt-3 flex flex-wrap gap-2">
          {VARIANTS.map((v, i) => (
            <a
              key={v.id}
              href={`#${v.id}`}
              className="rounded-full border border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
            >
              {i + 1}. {v.title}
            </a>
          ))}
        </nav>
      </header>

      <div className="flex-1 overflow-y-auto">
        {VARIANTS.map((v, i) => {
          const { Component } = v;
          return (
            <section key={v.id} id={v.id} className="scroll-mt-4 border-b border-[var(--border)]">
              <div className="sticky top-0 z-20 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-[var(--border)] bg-[var(--background)]/95 px-6 py-3 backdrop-blur">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-[var(--accent)]">
                  {i + 1} · {v.title}
                </span>
                <span className="text-xs text-[var(--faint)]">draws on {v.draws}</span>
                <span className="w-full text-xs text-[var(--muted)] sm:w-auto">{v.note}</span>
              </div>
              <div className="px-6 py-8">
                <Component />
              </div>
            </section>
          );
        })}

        <footer className="px-6 py-10 text-center text-xs text-[var(--faint)]">
          Disposable exploration · dx/settings · reimplement the chosen variant via a downstream
          SOW.
        </footer>
      </div>
    </main>
  );
}
