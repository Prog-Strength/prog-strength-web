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
