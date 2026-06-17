"use client";

/**
 * IDIOM: athletic-display-bold  ·  draws on Whoop (single-accent-on-charcoal
 * + bold stat typography), with a Nike-Training motivational register.
 *
 * Prog Strength's athletic identity turned up. Leans the design system's
 * SCOPED condensed athletic display face (Oswald — permitted as a display
 * accent on athletic surfaces) for a near-uppercase headline and big stat
 * numerals, with Nunito carrying the body. TYPE: huge condensed display +
 * mid body, maximum contrast in scale and weight. COLOR: violet used
 * confidently as a PRIMARY color — it carries the page, not just the
 * button. SPACING: a punchy headline block, then a hard stat band, then
 * deliberate gaps. The variant that looks like no other SaaS landing.
 *
 * Oswald is loaded scoped to this variant's root (.var(--font-oswald)) so
 * it never leaks into the rest of the app — exactly the "display accent
 * only" rule from the design system.
 */

import { Oswald } from "next/font/google";
import { BrandMark } from "@/components/brand-mark";
import { GoogleGlyph, reassurance, useLoginHref } from "../_shared/cta";

const oswald = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

const stats = [
  { value: "550", unit: "kcal", label: "logged from one sentence" },
  { value: "36g", unit: "protein", label: "tracked, automatically" },
  { value: "1RM", unit: "↑", label: "estimates that climb" },
];

export function AthleticDisplayBold() {
  const loginHref = useLoginHref();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--background)]">
      {/* Violet carries the page: a bold diagonal accent wash, not a timid glow. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(139,124,246,0.22) 0%, transparent 38%), linear-gradient(315deg, rgba(119,101,236,0.16) 0%, transparent 40%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-fg)]">
            <BrandMark size={22} />
          </span>
          <span className="text-base font-semibold uppercase tracking-[0.18em]" style={oswaldStyle}>
            Prog Strength
          </span>
        </div>

        {/* Condensed uppercase display headline — the athletic register. */}
        <h1
          className="mt-10 text-[clamp(3.5rem,12vw,8rem)] font-bold uppercase leading-[0.92] tracking-tight"
          style={oswaldStyle}
        >
          Train.
          <br />
          Log.
          <br />
          <span className="text-[var(--accent)]">Progress.</span>
        </h1>

        <p className="mt-8 max-w-xl text-lg font-semibold leading-relaxed text-[var(--muted)]">
          Tell the coach what you trained — it logs the macros, the lifts, and the PRs. You just
          keep showing up.
        </p>

        {/* Hard stat band — big condensed numerals, the Whoop move. */}
        <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--border-strong)] sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="bg-[var(--surface)] px-6 py-7">
              <div className="flex items-baseline gap-1.5">
                <span className="text-5xl font-bold text-[var(--foreground)]" style={oswaldStyle}>
                  {s.value}
                </span>
                <span className="text-sm font-bold uppercase tracking-wide text-[var(--accent)]">
                  {s.unit}
                </span>
              </div>
              <p className="mt-2 text-sm font-semibold text-[var(--muted)]">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-start gap-3">
          <a
            href={loginHref ?? "#"}
            aria-disabled={!loginHref}
            className={`inline-flex items-center justify-center gap-3 rounded-full bg-[var(--accent)] px-8 py-4 text-base font-bold uppercase tracking-wide text-[var(--accent-fg)] transition hover:bg-[var(--accent-dark)] ${
              loginHref ? "" : "pointer-events-none opacity-50"
            }`}
            style={oswaldStyle}
          >
            <span className="rounded-full bg-white p-1">
              <GoogleGlyph size={16} />
            </span>
            Continue with Google
          </a>
          <p className="text-xs font-semibold text-[var(--faint)]">{reassurance}</p>
        </div>
      </div>
    </div>
  );
}

// Applied via inline style so the scoped Oswald family never escapes this
// variant (the design system permits it as a display accent only).
const oswaldStyle: React.CSSProperties = { fontFamily: oswald.style.fontFamily };
