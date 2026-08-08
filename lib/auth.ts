/**
 * Client-side token storage.
 *
 * Tokens are dropped in localStorage after the OAuth callback page reads
 * them out of the URL hash fragment. They're sent as `Authorization:
 * Bearer <token>` on every call to the agent.
 *
 * localStorage is XSS-readable, which is the trade-off we accept for not
 * dealing with cross-subdomain HttpOnly cookies. Standard for an MVP
 * personal-tool app; revisit if multi-tenant.
 */

const TOKEN_KEY = "ps_access_token";
const EXPIRES_AT_KEY = "ps_access_token_expires_at";

export function setToken(token: string, expiresInSeconds?: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  if (expiresInSeconds !== undefined) {
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  const expiresAtRaw = localStorage.getItem(EXPIRES_AT_KEY);
  if (expiresAtRaw) {
    const expiresAt = parseInt(expiresAtRaw, 10);
    if (!Number.isNaN(expiresAt) && Date.now() > expiresAt) {
      clearToken();
      return null;
    }
  }
  return token;
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EXPIRES_AT_KEY);
}

export function isAuthenticated(): boolean {
  return getToken() !== null;
}

const POST_LOGIN_PATH_KEY = "ps_post_login_path";

/**
 * Remember where to land after sign-in.
 *
 * The OAuth round trip goes through Google and the API and comes back on a
 * fixed `return_to` (/auth/callback) that the API validates against an
 * allowlist — so the destination cannot ride along in the URL without
 * widening that contract. sessionStorage carries it across the redirect
 * instead: same tab, cleared when the tab closes, never sent to a server.
 *
 * This exists for deep links that originate OUTSIDE the app — the "Open in
 * Prog Strength" footer on a synced Google Calendar event, most of all. Those
 * are very often clicked by a logged-out user, and landing them on the
 * dashboard instead of the session they asked for defeats the link.
 *
 * Only same-origin absolute paths are stored. A caller-supplied "//evil.com"
 * or "https://evil.com" would otherwise turn sign-in into an open redirect.
 */
export function setPostLoginPath(path: string): void {
  if (typeof window === "undefined") return;
  if (!path.startsWith("/") || path.startsWith("//")) return;
  sessionStorage.setItem(POST_LOGIN_PATH_KEY, path);
}

/**
 * Consume the remembered post-login destination, falling back to the
 * dashboard. Reading clears it, so a later manual sign-in does not replay a
 * stale destination.
 */
export function takePostLoginPath(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  const path = sessionStorage.getItem(POST_LOGIN_PATH_KEY);
  sessionStorage.removeItem(POST_LOGIN_PATH_KEY);
  if (!path || !path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}
