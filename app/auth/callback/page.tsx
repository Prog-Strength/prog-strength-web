"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { setToken } from "@/lib/auth";

/**
 * OAuth landing page. The API's callback redirects here with the token
 * embedded in the URL hash fragment:
 *
 *   /auth/callback#access_token=<jwt>&expires_in=<seconds>
 *
 * The hash isn't sent to the server, so the token doesn't leak via the
 * referrer or appear in server access logs. We parse it client-side,
 * stash in localStorage, clear the hash from the URL, and push to /chat.
 *
 * On error (no token, malformed hash) we surface a message rather than
 * silently bouncing back to /login — easier to debug.
 */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    const params = new URLSearchParams(hash);

    // Beta gate: the API redirects here with #error=beta_required when
    // the user's Google email isn't on the allowlist. Forward the
    // attempted email through to /beta-locked so the page can echo it
    // back ("you tried to sign in with X — contact admins to request
    // access for that address").
    const oauthError = params.get("error");
    if (oauthError === "beta_required") {
      const email = params.get("email") ?? "";
      window.history.replaceState({}, "", "/auth/callback");
      router.replace(`/beta-locked?email=${encodeURIComponent(email)}`);
      return;
    }

    const token = params.get("access_token");
    const expiresInRaw = params.get("expires_in");

    if (!token) {
      setError(
        "Sign-in didn't return an access token. Try going back to /login and starting over.",
      );
      return;
    }

    const expiresIn = expiresInRaw ? parseInt(expiresInRaw, 10) : undefined;
    setToken(token, Number.isFinite(expiresIn) ? expiresIn : undefined);

    // Strip the hash from the URL so the token isn't preserved in the
    // browser history. `replaceState` does this without a navigation.
    window.history.replaceState({}, "", "/auth/callback");
    router.replace("/chat");
  }, [router]);

  return (
    <main className="flex flex-1 items-center justify-center px-6">
      {error ? (
        <div className="max-w-md space-y-4 text-center">
          <p className="text-sm text-[var(--danger)]">{error}</p>
          <a
            href="/login"
            className="inline-block rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm hover:bg-[var(--surface-2)]"
          >
            Back to sign-in
          </a>
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">Signing you in…</p>
      )}
    </main>
  );
}
