import { BrandMark } from "@/components/brand-mark";
import { GoogleCtaButton } from "./google-cta-button";

/**
 * The compact hero — the opener of the scroll, not a full-screen splash.
 * Brand lockup ("P" mark + wordmark), a headline leading with the
 * AI-logging hook, one or two subcopy lines, and the primary
 * `GoogleCtaButton`. Deliberately tight vertical rhythm so it sets up the
 * feature-row stack below rather than dominating the viewport.
 */
export function Hero({ loginHref }: { loginHref: string | null }) {
  return (
    <section className="flex flex-col items-center gap-7 text-center">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-[var(--shadow-soft)]">
          <BrandMark size={28} />
        </span>
        <span className="text-lg font-bold tracking-tight">Prog Strength</span>
      </div>

      <div className="flex max-w-2xl flex-col gap-4">
        <h1 className="text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          Tell it what you trained. It does the rest.
        </h1>
        <p className="text-pretty text-base text-[var(--muted)] sm:text-lg">
          Log meals and workouts in plain English. Track macros, lifts, and PRs — and talk to a
          coach that actually knows your training.
        </p>
      </div>

      <GoogleCtaButton loginHref={loginHref} size="lg" />
    </section>
  );
}
