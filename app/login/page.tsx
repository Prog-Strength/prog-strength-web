"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { config } from "@/lib/config";
import { isAuthenticated } from "@/lib/auth";
import { BrandMark } from "@/components/brand-mark";

/**
 * "Continue with Google" → kicks off OAuth at the API. The API knows how
 * to redirect to Google, validate the callback, mint a JWT, and bounce
 * back to <return_to>#access_token=…&expires_in=… — where return_to is
 * this app's /auth/callback page.
 */
export default function LoginPage() {
  const router = useRouter();
  const [returnTo, setReturnTo] = useState<string | null>(null);

  useEffect(() => {
    // If the user is already logged in, don't make them re-OAuth.
    if (isAuthenticated()) {
      router.replace("/chat");
      return;
    }
    // window.location.origin is only available client-side; compute the
    // return URL here so it works under both localhost and Vercel
    // preview/prod hostnames without env-var maintenance.
    setReturnTo(`${window.location.origin}/auth/callback`);
  }, [router]);

  const loginHref =
    returnTo &&
    `${config.apiUrl}/auth/google/login?return_to=${encodeURIComponent(returnTo)}`;

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <header className="flex flex-col items-center space-y-4 text-center">
          {/* Logo lockup: large brand mark in a soft surface tile, then
              wordmark + tagline. The tile gives the white P a defined
              edge without baking a background into the SVG itself. */}
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-lg shadow-black/40">
            <BrandMark size={56} />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              Prog Strength
            </h1>
            <p className="text-sm text-[var(--muted)]">
              Sign in to track and chat about your training.
            </p>
          </div>
        </header>

        <a
          href={loginHref ?? "#"}
          aria-disabled={!loginHref}
          className={`flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium transition hover:bg-[var(--surface-2)] ${
            loginHref ? "" : "pointer-events-none opacity-50"
          }`}
        >
          {/* Inline SVG instead of an image dependency so we have one
              fewer asset to ship and theme. */}
          <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A11 11 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84Z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38Z"
            />
          </svg>
          Continue with Google
        </a>

        <p className="text-center text-xs text-[var(--muted)]">
          We use Google sign-in to identify you. No password to manage.
        </p>
      </div>
    </main>
  );
}
