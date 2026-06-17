"use client";

/**
 * IDIOM: feature-showcase-stack  ·  draws on Notion
 *
 * Notion's feature-row scroll. Below a COMPACT hero, a vertical stack of
 * alternating feature rows — each pairs a one-line benefit with a small
 * mock, image-left / image-right alternating. TYPE: clear section headers
 * over readable body at mid scale (no giant display). COLOR: each row picks
 * up its OWN relevant macro/activity tint as a subtle section accent
 * (nutrition green, workouts amber, calendar blue), all unified by violet
 * CTAs top and bottom. SPACING: roomy, clearly sectioned editorial rhythm —
 * the most "scrolling landing page" of the five.
 */

import { BrandMark } from "@/components/brand-mark";
import { GoogleGlyph, reassurance, useLoginHref } from "../_shared/cta";
import { MacroRings } from "../_shared/mocks";
import { features, tintVars } from "../_shared/fixtures";

function CtaButton({ href }: { href: string | null }) {
  return (
    <a
      href={href ?? "#"}
      aria-disabled={!href}
      className={`inline-flex items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-bold text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)] ${
        href ? "" : "pointer-events-none opacity-50"
      }`}
    >
      <span className="rounded-full bg-white p-1">
        <GoogleGlyph size={15} />
      </span>
      Continue with Google
    </a>
  );
}

/** Tiny per-row mock, themed to the row's tint. */
function RowMock({ featureKey, tint }: { featureKey: string; tint: keyof typeof tintVars }) {
  const { fg, bg } = tintVars[tint];
  if (featureKey === "nutrition") {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8">
        <MacroRings size={68} />
      </div>
    );
  }
  if (featureKey === "coach") {
    return (
      <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex justify-end">
          <span className="rounded-2xl rounded-br-md bg-[var(--accent)] px-3 py-2 text-xs font-medium text-[var(--accent-fg)]">
            squat 5×5 @ 225
          </span>
        </div>
        <div className="rounded-2xl rounded-bl-md bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--foreground)]">
          <span className="mb-1 inline-block rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent)]">
            ✓ Log Workout
          </span>
          <p>Logged 5 sets of squats. That&apos;s a 10 lb jump from last week. 🔥</p>
        </div>
      </div>
    );
  }
  if (featureKey === "workouts") {
    const bars = [40, 52, 48, 64, 72, 88];
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8">
        <div className="mb-3 text-xs font-semibold text-[var(--muted)]">Estimated 1RM · Bench</div>
        <div className="flex h-28 items-end gap-2">
          {bars.map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-t-md"
              style={{ height: `${h}%`, background: i === bars.length - 1 ? fg : bg }}
            />
          ))}
        </div>
      </div>
    );
  }
  // calendar streak grid
  const days = Array.from({ length: 28 }, (_, i) =>
    [2, 3, 5, 6, 9, 10, 12, 13, 16, 17, 19, 20, 23, 24, 26].includes(i),
  );
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-6 py-8">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-[var(--muted)]">
        <span>June</span>
        <span style={{ color: fg }}>12-day streak 🔥</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((on, i) => (
          <div
            key={i}
            className="aspect-square rounded-md"
            style={{ background: on ? fg : "var(--surface-2)", opacity: on ? 1 : 0.6 }}
          />
        ))}
      </div>
    </div>
  );
}

export function FeatureShowcaseStack() {
  const loginHref = useLoginHref();

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="mx-auto max-w-5xl px-6 py-16">
        {/* Compact hero */}
        <header className="flex flex-col items-center text-center">
          <div className="flex items-center gap-2.5">
            <BrandMark size={26} className="text-[var(--accent)]" />
            <span className="text-sm font-bold tracking-tight">Prog Strength</span>
          </div>
          <h1 className="mt-8 max-w-2xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Everything you train, tracked from a sentence.
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-[var(--muted)]">
            Tell the coach what you ate or lifted. It handles the macros, the lifts, the PRs, and
            the streaks — so you can just keep training.
          </p>
          <div className="mt-8">
            <CtaButton href={loginHref} />
          </div>
        </header>

        {/* Alternating feature rows, each with its own tint */}
        <div className="mt-24 flex flex-col gap-24">
          {features.map((f, i) => {
            const { fg, bg } = tintVars[f.tint];
            const imageRight = i % 2 === 1;
            return (
              <section key={f.key} className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
                <div className={imageRight ? "md:order-1" : "md:order-2"}>
                  <RowMock featureKey={f.key} tint={f.tint} />
                </div>
                <div className={imageRight ? "md:order-2" : "md:order-1"}>
                  <span
                    className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
                    style={{ color: fg, background: bg }}
                  >
                    {f.title}
                  </span>
                  <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{f.title}</h2>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-[var(--muted)]">
                    {f.blurb}
                  </p>
                </div>
              </section>
            );
          })}
        </div>

        {/* Closing CTA — unified violet, bottom of the scroll */}
        <footer className="mt-28 flex flex-col items-center rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
          <h2 className="max-w-lg text-3xl font-extrabold tracking-tight">
            Start logging in plain English.
          </h2>
          <p className="mt-3 max-w-md text-sm text-[var(--muted)]">
            One sign-in and the coach is ready. No setup, no spreadsheets.
          </p>
          <div className="mt-7">
            <CtaButton href={loginHref} />
          </div>
          <p className="mt-3 text-xs text-[var(--faint)]">{reassurance}</p>
        </footer>
      </div>
    </div>
  );
}
