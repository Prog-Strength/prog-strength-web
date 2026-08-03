/**
 * RunningEmptyCard — the shared `present: false` body for every
 * running-family tile. One empty grammar, four different headings (each tile
 * passes its catalog title), over the existing import-a-run CTA — the same
 * generalization RecoveryConnectCard made for its family.
 */

import { MiniCard, MiniCardEmpty } from "../mini-card";

export function RunningEmptyCard({ title, href }: { title: string; href: string }) {
  return (
    <MiniCard title={title} href={href}>
      <MiniCardEmpty cta="Import a run to start tracking" />
    </MiniCard>
  );
}
