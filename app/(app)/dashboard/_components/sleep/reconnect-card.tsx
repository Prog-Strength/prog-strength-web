/**
 * SleepReconnectCard — the sleep tile's under-scoped state.
 *
 * A Whoop grant is fixed at consent and a token refresh cannot WIDEN it, so a
 * connection made before `read:sleep` was requested is connected, valid, and
 * permanently sleepless until the user re-consents. Settings → Integrations
 * says so too, but the dashboard is where the user will notice the absence —
 * this is the same message, at the place the question gets asked.
 *
 * It links to Settings rather than to the API's connect endpoint: the tile is a
 * signpost, the Settings card is the control, and duplicating the OAuth
 * navigation in two components is how the two drift. The copy names what is
 * missing in product terms and matches the Settings row word for word —
 * `read:sleep` is not a user-facing noun.
 */

import { MiniCard, MiniCardEmpty } from "../mini-card";

/** Where the actual Reconnect control lives. */
export const SETTINGS_INTEGRATIONS_HREF = "/settings?tab=integrations";

export function SleepReconnectCard({ href }: { href: string }) {
  return (
    <MiniCard title="Sleep" href={href}>
      <MiniCardEmpty cta="Reconnect to enable sleep tracking" />
      <p className="text-xs text-[var(--muted)]">Your Whoop connection predates it.</p>
    </MiniCard>
  );
}
