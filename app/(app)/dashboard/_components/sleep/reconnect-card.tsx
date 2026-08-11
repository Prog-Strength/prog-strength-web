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
 * navigation in two components is how the two drift. For the same reason the
 * words and the href are both READ from `lib/whoop.ts` rather than written
 * here — "matches the Settings row word for word" is a claim only a shared
 * constant can actually keep.
 */

import {
  SETTINGS_INTEGRATIONS_HREF,
  SLEEP_RECONNECT_CTA,
  SLEEP_RECONNECT_REASON,
} from "@/lib/whoop";
import { MiniCard, MiniCardEmpty } from "../mini-card";

export function SleepReconnectCard() {
  return (
    <MiniCard title="Sleep" href={SETTINGS_INTEGRATIONS_HREF}>
      <MiniCardEmpty cta={SLEEP_RECONNECT_CTA} />
      <p className="text-xs text-[var(--muted)]">{SLEEP_RECONNECT_REASON}</p>
    </MiniCard>
  );
}
