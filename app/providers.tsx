"use client";

/**
 * App-wide client providers.
 *
 * Currently mounts the TanStack Query client. The QueryClient is created
 * once at module scope (a stable singleton) rather than inside the
 * component so it survives re-renders and isn't recreated on every mount —
 * the app is a single client session, so there's no need for the
 * per-request client pattern Next.js docs describe for shared SSR caches.
 *
 * Defaults: a 60s `staleTime` so quick view toggles on the
 * personal-records page reuse cached data instead of refetching, and
 * `refetchOnWindowFocus: false` to avoid surprise reloads when the user
 * tabs back to the page.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
