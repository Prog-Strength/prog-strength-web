/**
 * Runtime configuration sourced from NEXT_PUBLIC_* env vars.
 *
 * Defaults target local dev: the API on :8080, the agent on :8001, and
 * the app itself on :3000 (Next's default). In production these are set
 * in the Vercel project's environment to the public hostnames.
 */

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
  agentUrl: process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:8001",
  // Where the OAuth callback should redirect back to. Almost always
  // window.location.origin in practice; exposed as a config to make
  // it overridable for testing (e.g., behind a Vercel preview URL).
  appUrl:
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
  // Shown on the beta-locked page so rejected users know where to
  // request access. The default is the project owner's personal
  // address — override via the env var if you set up a dedicated
  // alias later.
  betaContactEmail: process.env.NEXT_PUBLIC_BETA_CONTACT_EMAIL ?? "jimmy.wallace145@gmail.com",
  // Gate for throwaway Design Exploration (DX) comparison routes under
  // /design-explore/*. Off unless NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE === "true",
  // so these mockup-only routes are dead (404) in production and never
  // reachable via normal product navigation. Not set in the Vercel project.
  enableDesignExplore: process.env.NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE === "true",
};
