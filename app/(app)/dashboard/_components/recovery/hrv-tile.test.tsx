/// <reference types="vitest/globals" />

import { render, screen, within } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import { calibratingView, legacyView, risingView, suppressedDriftView } from "./fixtures";
import { HrvTileCard } from "./hrv-tile";

const HREF = "/recovery";

function renderTile(section: RecoveryView) {
  return render(<HrvTileCard section={section} href={HREF} />);
}

describe("HrvTileCard", () => {
  it("renders the balance view under the HRV Balance title", () => {
    const { container } = renderTile(risingView());
    expect(screen.getByRole("heading", { name: "HRV Balance" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });

  // DELETION PIN. The Recovery Trend view is gone and the pager with it — the
  // card is a plain MiniCard again, so the whole panel carries no button. A
  // reintroduced pager fails here first, which is the point: restoring it means
  // restoring the hand-composed panel, since a button inside the card's anchor
  // is invalid markup and swallows its own clicks.
  it("carries no pager, and no second view to page to", () => {
    const { container } = renderTile(risingView());
    expect(container.querySelectorAll("button")).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: "Recovery Trend" })).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="hrv-view-trend"]')).toBeNull();
  });

  it("one figure, three registers: the curve ends where the gauge points", () => {
    // `short_avg` is printed at 28px, positioned by the gauge tick, and drawn as
    // the curve's last mark — the same number in three places, so the colour of
    // the tick and of the final dot are one value.
    const { container } = renderTile(risingView());
    const dots = Array.from(container.querySelectorAll("circle"));
    const tick = container.querySelector('[data-testid="gauge-tick"]');

    expect(screen.getByText("93")).toBeInTheDocument(); // shortAvg 92.8
    expect(dots.at(-1)!.getAttribute("fill")).toBe(
      tick
        ?.getAttribute("style")
        ?.match(/background-color:\s*([^;]+)/)?.[1]
        .trim(),
    );
  });

  // The balance view plots the 7-DAY MEAN — one mark per drawn day, six of the
  // 31 held back as lead-in for the first rolling window. Kept from the paged
  // era, where it also pinned that the rail marked every night; the chart's own
  // half of that contract is unchanged by the rail's removal.
  it("plots one mark per drawn day, six short of the payload", () => {
    const { container } = renderTile(risingView());
    const dots = Array.from(container.querySelectorAll("circle"));
    expect(dots).toHaveLength(risingView().days!.length - 6);
  });

  it("one verdict per question: last night's word and the week's figure", () => {
    // suppressedDriftView is the case that used to split the pair of tiles:
    // today is suppressed AND the week is suppressed. Both still say so in
    // their own register — the dot for the night, the gauge for the week.
    const { container } = renderTile(suppressedDriftView());
    const card = within(container);
    expect(card.getByText("Suppressed")).toBeInTheDocument();
    expect(card.getByText("77")).toBeInTheDocument();
  });

  it("calibrating: one honest progress state for the whole tile", () => {
    const { container } = renderTile(calibratingView());
    expect(screen.getByText(/9 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });

  it("legacy payload: the guard holds, nothing throws", () => {
    const { container } = renderTile(legacyView());
    expect(screen.getByText(/0 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
