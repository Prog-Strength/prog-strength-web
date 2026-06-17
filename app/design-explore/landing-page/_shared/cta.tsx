"use client";

import { useEffect, useState } from "react";
import { config } from "@/lib/config";

/**
 * Shared CTA plumbing for the DX variants. The OAuth contract is a fixed
 * point (see the ticket): the multicolor Google "G" glyph and the
 * "No password to manage." reassurance are trust signals, not decoration,
 * so they live here and stay identical across variants. Each variant
 * styles its own *button shell* around <GoogleGlyph/> — that's layout, not
 * a second auth path.
 */

export const reassurance = "We use Google sign-in to identify you. No password to manage.";

/**
 * Resolves the OAuth href client-side, exactly like app/login/page.tsx.
 * Returns null until window.location.origin is known, so the button can
 * render a deliberate "not yet ready" state rather than a broken link.
 */
export function useLoginHref(): string | null {
  const [returnTo, setReturnTo] = useState<string | null>(null);
  useEffect(() => {
    setReturnTo(`${window.location.origin}/auth/callback`);
  }, []);
  return returnTo
    ? `${config.apiUrl}/auth/google/login?return_to=${encodeURIComponent(returnTo)}`
    : null;
}

/** The inline multicolor Google "G". A fixed trust signal — restyle around it, not it. */
export function GoogleGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
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
  );
}
