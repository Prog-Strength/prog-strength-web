"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { config } from "@/lib/config";
import { BrandMark } from "@/components/brand-mark";

/**
 * Shown when a user completes Google OAuth but their email isn't on
 * the BETA_ALLOWED_EMAILS allowlist on the API. The attempted email is
 * passed through as a query param (the OAuth callback decodes it from
 * the URL hash fragment before pushing here).
 *
 * Wrapped in <Suspense> because useSearchParams requires it under the
 * App Router — Next renders a fallback while the hook resolves.
 */
export default function BetaLocked() {
  return (
    <Suspense fallback={<Shell email={null} />}>
      <BetaLockedContent />
    </Suspense>
  );
}

function BetaLockedContent() {
  const params = useSearchParams();
  const email = params.get("email") || null;
  return <Shell email={email} />;
}

function Shell({ email }: { email: string | null }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <header className="flex flex-col items-center space-y-4">
          {/* Same lockup as the login page so users who get bounced
              here recognize this as the same product, just gated. */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-lg shadow-black/40">
            <BrandMark size={44} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Prog Strength is in private beta
            </h1>
            <p className="text-sm text-[var(--muted)]">Access is currently invite-only.</p>
          </div>
        </header>

        {email && (
          <p className="text-sm">
            You signed in as <span className="font-mono text-[var(--foreground)]">{email}</span>,
            but that address isn&apos;t on the beta list yet.
          </p>
        )}

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-left text-sm">
          <p className="mb-2 font-medium">Want in?</p>
          <p className="text-[var(--muted)]">
            Email{" "}
            <a
              href={`mailto:${config.betaContactEmail}?subject=Prog%20Strength%20beta%20access${email ? `&body=Please%20add%20${encodeURIComponent(email)}%20to%20the%20beta%20list.` : ""}`}
              className="text-[var(--accent)] underline-offset-4 hover:underline"
            >
              {config.betaContactEmail}
            </a>{" "}
            and mention which Google account you&apos;d like authorized.
          </p>
        </div>

        <a
          href="/login"
          className="inline-block text-xs text-[var(--muted)] underline-offset-4 hover:underline"
        >
          Try a different Google account
        </a>
      </div>
    </main>
  );
}
