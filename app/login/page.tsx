"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { isAuthenticated } from "@/lib/auth";
import { Hero } from "./_components/hero";
import { FeatureRow } from "./_components/feature-row";
import { ChatProofMock } from "./_components/chat-proof-mock";
import { MacroRingsMock, PrStatMock, CalendarStreakMock } from "./_components/supporting-mocks";
import { GoogleCtaButton } from "./_components/google-cta-button";

/**
 * The unauthenticated front door. Rendered outside the app shell (this
 * route lives outside the `(app)` route group), it's the feature-showcase-
 * stack landing page: a compact hero, an editorial stack of alternating
 * feature rows (chat proof, macros, PRs, calendar), and a closing CTA.
 *
 * Everything below the OAuth wiring is a static fixture — no API calls, no
 * live data on a page served to logged-out visitors. The single action is
 * "Continue with Google", which kicks off OAuth at the API: the API
 * redirects to Google, validates the callback, mints a JWT, and bounces
 * back to <return_to>#access_token=…&expires_in=… — where return_to is
 * this app's /auth/callback page.
 */
export default function LoginPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    // If the user is already logged in, don't make them re-OAuth — and
    // don't show them the marketing landing they don't need.
    if (isAuthenticated()) {
      router.replace("/dashboard");
      return;
    }
    // window.location.origin is only available client-side; compute the
    // return URL here so it works under both localhost and Vercel
    // preview/prod hostnames without env-var maintenance.
    setReturnTo(`${window.location.origin}/auth/callback`);
  }, [router]);

  // Until return_to resolves the href is null and the CTA renders disabled
  // (not-yet-ready, never broken) — see GoogleCtaButton.
  const loginHref =
    returnTo && `${config.apiUrl}/auth/google/login?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16 sm:py-20">
      <div className="flex w-full max-w-5xl flex-col gap-20 sm:gap-28">
        <Hero loginHref={loginHref} />

        <div className="flex flex-col gap-20 sm:gap-28">
          <FeatureRow
            index={0}
            eyebrow="AI coach"
            title="A coach you talk to in plain English."
            body="Type what you ate or how you trained and it logs it — parsing the meal, the macros, and the sets for you. Ask it anything about your training and it answers from your own data."
            tint={null}
            mock={<ChatProofMock />}
          />
          <FeatureRow
            index={1}
            eyebrow="Nutrition & macros"
            title="Macros tracked, not tallied by hand."
            body="Every logged meal rolls up into your daily protein, carb, and fat rings against your goals — so you always know where the day stands."
            tint="var(--macro-protein)"
            mock={<MacroRingsMock />}
          />
          <FeatureRow
            index={2}
            eyebrow="Workouts & PRs"
            title="Watch your lifts actually climb."
            body="Log sets as fast as you can say them. Prog Strength tracks every exercise and estimates your 1RMs so you can see the line going up."
            tint="var(--macro-fat)"
            mock={<PrStatMock />}
          />
          <FeatureRow
            index={3}
            eyebrow="Calendar & progress"
            title="Show up, and keep showing up."
            body="A training calendar that turns consistency into a streak worth protecting, with progress you can see week over week."
            tint="var(--macro-carb)"
            mock={<CalendarStreakMock />}
          />
        </div>

        {/* Closing CTA — the same single auth action repeated at the foot of
            the scroll, never a second auth path. */}
        <section className="flex flex-col items-center gap-6 text-center">
          <h2 className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            Start logging in plain English.
          </h2>
          <GoogleCtaButton loginHref={loginHref} size="lg" />
        </section>
      </div>
    </main>
  );
}
