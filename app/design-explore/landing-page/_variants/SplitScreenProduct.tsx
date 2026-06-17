"use client";

/**
 * IDIOM: split-screen-product  ·  draws on Vercel / Stripe
 *
 * Vercel/Stripe asymmetry. Two columns: the LEFT is value copy + Google CTA
 * + reassurance, left-aligned and dense; the RIGHT is a full-bleed,
 * live-looking product panel — the real chat exchange with the macro table,
 * raised on the slate ramp. TYPE is mid-scale, left-aligned, with a tight
 * headline (no centered display drama). COLOR: violet anchors the left CTA;
 * the right panel carries the macro-tint palette. SPACING is compact and
 * structured on the left, edge-to-edge on the right — the product does the
 * talking. Collapses to stacked on narrow widths.
 */

import { BrandMark } from "@/components/brand-mark";
import { GoogleGlyph, reassurance, useLoginHref } from "../_shared/cta";
import { MacroTable } from "../_shared/mocks";
import { chatExchange } from "../_shared/fixtures";

export function SplitScreenProduct() {
  const loginHref = useLoginHref();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[var(--background)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      {/* LEFT — dense, left-aligned copy column */}
      <div className="flex flex-col justify-center px-8 py-16 sm:px-14">
        <div className="flex items-center gap-2.5">
          <BrandMark size={26} className="text-[var(--accent)]" />
          <span className="text-sm font-bold tracking-tight">Prog Strength</span>
        </div>

        <h1 className="mt-12 max-w-md text-4xl font-extrabold leading-[1.1] tracking-tight">
          Log your training by just saying it.
        </h1>
        <p className="mt-5 max-w-md text-base leading-relaxed text-[var(--muted)]">
          Tell the coach what you ate or lifted in plain English. It parses the macros, logs the
          sets, and tracks your PRs — no forms, no spreadsheets.
        </p>

        <ul className="mt-8 flex max-w-md flex-col gap-3 text-sm text-[var(--muted)]">
          {[
            "Natural-language meal & workout logging",
            "Macros, lifts, and estimated 1RMs",
            "A coach that reads your whole history",
          ].map((line) => (
            <li key={line} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[11px] font-bold text-[var(--accent)]">
                ✓
              </span>
              {line}
            </li>
          ))}
        </ul>

        <div className="mt-10 max-w-md">
          <a
            href={loginHref ?? "#"}
            aria-disabled={!loginHref}
            className={`inline-flex items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)] ${
              loginHref ? "" : "pointer-events-none opacity-50"
            }`}
          >
            <span className="rounded-full bg-white p-1">
              <GoogleGlyph size={15} />
            </span>
            Continue with Google
          </a>
          <p className="mt-3 text-xs text-[var(--faint)]">{reassurance}</p>
        </div>
      </div>

      {/* RIGHT — full-bleed product panel: the live-looking chat exchange */}
      <div className="relative flex items-center overflow-hidden border-t border-[var(--border)] bg-[var(--surface)] px-8 py-16 sm:px-12 lg:border-l lg:border-t-0">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 top-1/4 h-80 w-80 rounded-full blur-[110px]"
          style={{ background: "radial-gradient(circle, rgba(139,124,246,0.20), transparent 70%)" }}
        />
        <div className="relative z-10 w-full max-w-xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--faint)]">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--macro-protein)]" />
            Live demo · the chat
          </div>

          <div className="space-y-4 rounded-3xl border border-[var(--border-strong)] bg-[var(--background)] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.5)]">
            {/* user bubble */}
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent-fg)]">
                {chatExchange.userMessage}
              </p>
            </div>

            {/* assistant card */}
            <div className="space-y-3 rounded-2xl rounded-bl-md bg-[var(--surface-2)] p-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--macro-protein-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--macro-protein)]">
                  ✓ {chatExchange.toolChip.label}
                </span>
                <span className="text-[11px] text-[var(--faint)]">{chatExchange.model}</span>
              </div>
              <p className="text-sm text-[var(--foreground)]">{chatExchange.assistantIntro}</p>
              <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)] p-1">
                <MacroTable density="tight" />
              </div>
              <p className="text-sm font-medium text-[var(--foreground)]">
                {chatExchange.assistantOutro}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
