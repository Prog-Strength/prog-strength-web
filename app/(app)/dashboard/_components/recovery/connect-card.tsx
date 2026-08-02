/**
 * RecoveryConnectCard — the shared `present: false` body for every
 * recovery-family tile. One empty grammar, five different headings: each tile
 * passes its own catalog title so an unconnected user still sees which tile
 * they added, over the same connect CTA. Generalizes the old
 * RecoveryCardEmpty (whoop-card.tsx), which hardcoded the "Recovery" title.
 */

import { MiniCard, MiniCardEmpty } from "../mini-card";

export function RecoveryConnectCard({ title, href }: { title: string; href: string }) {
  return (
    <MiniCard title={title} href={href}>
      <MiniCardEmpty cta="Connect Whoop to see recovery" />
    </MiniCard>
  );
}
