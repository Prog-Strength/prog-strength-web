"use client";

/**
 * IDIOM: centered-hero-spotlight  ·  draws on Linear
 *
 * Linear's marketing calm on our dark slate. A single centered column —
 * lockup, large display headline, quiet subline, the Google CTA — with one
 * framed app screenshot floating below and a soft violet glow behind the
 * brand mark. Hierarchy is by SCALE: a big headline over modest body.
 * COLOR is near-monochrome slate; violet is reserved for the CTA and the
 * glow, and the macro tints appear only inside the framed screenshot.
 * SPACING is airy — generous vertical rhythm, lots of negative space.
 * The restrained, premium baseline of the five.
 */

import { BrandMark } from "@/components/brand-mark";
import { GoogleGlyph, reassurance, useLoginHref } from "../_shared/cta";
import { MacroRings } from "../_shared/mocks";

export function CenteredHeroSpotlight() {
  const loginHref = useLoginHref();

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[var(--background)] px-6 py-24 text-center">
      {/* Soft violet glow behind the brand mark — the single permitted use
          of accent as ambient color in this restrained variant. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-28 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-[120px]"
        style={{ background: "radial-gradient(circle, rgba(139,124,246,0.28), transparent 70%)" }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)]">
          <BrandMark size={42} />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
          Prog Strength
        </p>

        <h1 className="mt-8 text-balance text-5xl font-extrabold leading-[1.05] tracking-tight text-[var(--foreground)] sm:text-6xl">
          Tell it what you trained.
          <br />
          <span className="text-[var(--muted)]">It does the rest.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-[var(--muted)]">
          Log meals and workouts in plain English. Track macros, lifts, and PRs — and talk to a
          coach that actually knows your training.
        </p>

        <a
          href={loginHref ?? "#"}
          aria-disabled={!loginHref}
          className={`mt-10 inline-flex items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-7 py-3.5 text-base font-bold text-[var(--accent-fg)] shadow-[0_8px_30px_rgba(139,124,246,0.35)] transition hover:bg-[var(--accent-dark)] ${
            loginHref ? "" : "pointer-events-none opacity-50"
          }`}
        >
          <span className="rounded-full bg-white p-1">
            <GoogleGlyph size={16} />
          </span>
          Continue with Google
        </a>
        <p className="mt-4 text-xs text-[var(--faint)]">{reassurance}</p>
      </div>

      {/* The one framed app screenshot, floating below. Carries the macro
          tints (the rings) — the only place color escapes the monochrome. */}
      <div className="relative z-10 mt-20 w-full max-w-3xl">
        <div className="rounded-3xl border border-[var(--border-strong)] bg-[var(--surface)] p-2 shadow-[0_30px_80px_rgba(0,0,0,0.55)]">
          <div className="rounded-[1.25rem] border border-[var(--border)] bg-[var(--background)] px-8 py-10">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-sm font-bold text-[var(--foreground)]">
                Today&apos;s macros
              </span>
              <span className="text-xs text-[var(--faint)]">Tuesday · 550 / 2,100 kcal</span>
            </div>
            <MacroRings size={96} />
          </div>
        </div>
      </div>
    </div>
  );
}
