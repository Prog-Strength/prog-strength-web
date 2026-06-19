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
  // Design-exploration routes under /design-explore/* are throwaway,
  // side-by-side variant comparisons (see app/design-explore/*). They are
  // never linked from product navigation and must be DEAD IN PRODUCTION.
  // They render on Vercel preview deploys (so a human can compare and
  // pick a direction) and locally when the flag is explicitly set — but
  // never when the build is production, regardless of the flag.
  //   · prod build        → VERCEL_ENV=production            → off, always
  //   · preview deploy     → VERCEL_ENV=preview              → on
  //   · local / other      → NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE=true → on
  // VERCEL_ENV is a build-time server var; the gate is read only in the
  // server component app/design-explore/.../page.tsx, never on the client.
  designExploreEnabled:
    process.env.VERCEL_ENV !== "production" &&
    (process.env.VERCEL_ENV === "preview" ||
      process.env.NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE === "true"),
};
