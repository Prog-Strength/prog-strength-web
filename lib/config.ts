/**
 * Runtime configuration sourced from NEXT_PUBLIC_* env vars.
 *
 * Defaults target local dev: the API on :8080, the agent on :8001, and
 * the app itself on :3000 (Next's default). In production these are set
 * in the Vercel project's environment to the public hostnames.
 */

// Parse a NEXT_PUBLIC_* flag as a boolean. Accepts any common truthy spelling
// (1/true/yes/on, case-insensitive) so a flag set to "true" on Vercel and a
// gate written against "1" in code can never silently disagree. Use this for
// every env-driven boolean rather than comparing to a single literal.
export const envFlag = (value: string | undefined): boolean =>
  /^(1|true|yes|on)$/i.test((value ?? "").trim());

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
  // THE single gate for every throwaway Design Exploration (DX) route under
  // /design-explore/*. There is exactly one DX env var across all DX work:
  // NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE. It is unset in production (so DX routes
  // `notFound()` and are dead/unreachable) and set to a truthy value on a
  // Vercel *preview* deploy when a reviewer wants to compare variants. Every DX
  // route must reuse THIS field — never invent a per-surface flag or a second
  // env var. Lives permanently on `main` so each `dx/*` branch reuses it
  // verbatim instead of re-deriving the gate.
  designExploreEnabled: envFlag(process.env.NEXT_PUBLIC_ENABLE_DESIGN_EXPLORE),
  // MapTiler tile key, powering the Topographic and Dark basemaps on activity
  // route maps (lib/map-styles.ts).
  //
  // This is CONFIGURATION, NOT A SECRET, and must not be handled as one. A
  // browser-side tile key is transmitted to the client by construction — it is
  // in the network tab of every user who opens a map, and no amount of
  // repository hygiene changes that. What actually protects it is the
  // provider-side control: an HTTP-referrer allowlist on the key in the
  // MapTiler console (localhost, the production domain, and *.vercel.app for
  // preview deploys). See .env.example.
  //
  // `null` is a supported state, not a misconfiguration: keyed styles drop out
  // of the switcher and the map falls back to the keyless OpenFreeMap basemap
  // with every overlay intact. Local dev and CI therefore need no key.
  maptilerKey: process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim() || null,
};
