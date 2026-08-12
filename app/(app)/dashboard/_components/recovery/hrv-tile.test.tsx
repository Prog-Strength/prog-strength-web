/// <reference types="vitest/globals" />

import { fireEvent, render, screen, within } from "@testing-library/react";
import type { RecoveryView } from "@/lib/dashboard";
import { calibratingView, legacyView, risingView, suppressedDriftView } from "./fixtures";
import { HrvTileCard } from "./hrv-tile";

const HREF = "/recovery";

function renderTile(section: RecoveryView) {
  return render(<HrvTileCard section={section} href={HREF} />);
}

function view(container: HTMLElement, key: "balance" | "trend"): HTMLElement {
  const el = container.querySelector(`[data-testid="hrv-view-${key}"]`);
  if (!el) throw new Error(`no ${key} view`);
  return el as HTMLElement;
}

function isShowing(container: HTMLElement, key: "balance" | "trend"): boolean {
  return view(container, key).getAttribute("data-active") === "true";
}

/** A left swipe across the card: start right, end left, past the threshold. */
function swipe(el: HTMLElement, dx: number) {
  fireEvent.touchStart(el, { touches: [{ clientX: 200 }] });
  fireEvent.touchEnd(el, { changedTouches: [{ clientX: 200 + dx }] });
}

describe("HrvTileCard", () => {
  it("opens on HRV Balance and titles the card for the view that is showing", () => {
    const { container } = renderTile(risingView());
    expect(screen.getByRole("heading", { name: "HRV Balance" })).toBeInTheDocument();
    expect(isShowing(container, "balance")).toBe(true);
    expect(isShowing(container, "trend")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Next view" }));
    expect(screen.getByRole("heading", { name: "Recovery Trend" })).toBeInTheDocument();
    expect(isShowing(container, "trend")).toBe(true);
  });

  it("pages by swipe, arrow key and dot, and stops at both ends", () => {
    const { container } = renderTile(risingView());
    const card = screen.getByRole("group", { name: "HRV" });

    swipe(card, -80);
    expect(isShowing(container, "trend")).toBe(true);
    // Past the last view a swipe is inert rather than wrapping.
    swipe(card, -80);
    expect(isShowing(container, "trend")).toBe(true);

    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(isShowing(container, "balance")).toBe(true);
    fireEvent.keyDown(card, { key: "ArrowLeft" });
    expect(isShowing(container, "balance")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Recovery Trend" }));
    expect(isShowing(container, "trend")).toBe(true);
  });

  it("a tap-sized drag is not a swipe", () => {
    const { container } = renderTile(risingView());
    swipe(screen.getByRole("group", { name: "HRV" }), -20);
    expect(isShowing(container, "balance")).toBe(true);
  });

  it("a swipe does not navigate into /recovery", () => {
    const { container } = renderTile(risingView());
    const card = screen.getByRole("group", { name: "HRV" });
    const link = container.querySelector("a")!;

    fireEvent.touchStart(card, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 100 }] });
    // fireEvent returns false when a handler called preventDefault.
    expect(fireEvent.click(link)).toBe(false);
    expect(link.getAttribute("href")).toBe(HREF);
  });

  it("an ordinary click is left alone — only the swipe's own click is swallowed", () => {
    // A hash href so jsdom can 'navigate' without complaining; what is under
    // test is that nothing prevented the default, not where it would have gone.
    const { container } = render(<HrvTileCard section={risingView()} href="#recovery" />);
    expect(fireEvent.click(container.querySelector("a")!)).toBe(true);
  });

  it("the pager's buttons are outside the link, so paging can't navigate", () => {
    const { container } = renderTile(risingView());
    const link = container.querySelector("a")!;
    for (const name of ["Next view", "Previous view", "Recovery Trend"]) {
      expect(link.contains(screen.getByRole("button", { name }))).toBe(false);
    }
  });

  it("both views are mounted, so the card does not resize when paging", () => {
    // The inactive view keeps its layout box (invisible, not unmounted) and is
    // hidden from the accessibility tree.
    const { container } = renderTile(risingView());
    expect(view(container, "trend").className).toContain("invisible");
    expect(view(container, "trend").getAttribute("aria-hidden")).toBe("true");
    expect(view(container, "balance").getAttribute("aria-hidden")).toBeNull();
  });

  it("the two views divide the subject: the week's pattern, and the nights", () => {
    // The merge's contract, restated for the smoothed chart. The balance view
    // plots the 7-DAY MEAN — one mark per drawn day, six of the 31 held back as
    // lead-in for the first window — while the rail still marks every night. The
    // two therefore answer different questions and cannot contradict each other
    // about a night, because only one of them is about nights at all.
    const { container } = renderTile(risingView());
    const dots = Array.from(view(container, "balance").querySelectorAll("circle"));
    const marks = Array.from(view(container, "trend").querySelectorAll('[role="img"] > span'));
    const days = risingView().days!;

    expect(marks).toHaveLength(days.length);
    expect(dots).toHaveLength(days.length - 6);
    // The rail's blank slots are still the nights with no reading.
    const blank = marks.filter(
      (m) => (m as HTMLElement).style.backgroundColor === "var(--surface-2)",
    );
    expect(blank).toHaveLength(days.filter((d) => d.hrv === null).length);
  });

  it("one figure, three registers: the curve ends where the gauge points", () => {
    // What the merge pins now. `short_avg` is printed at 28px, positioned by the
    // gauge tick, and drawn as the curve's last mark — the same number in three
    // places, so the colour of the tick and of the final dot are one value.
    const { container } = renderTile(risingView());
    const balance = view(container, "balance");
    const dots = Array.from(balance.querySelectorAll("circle"));
    const tick = balance.querySelector('[data-testid="gauge-tick"]');

    expect(within(balance).getByText("93")).toBeInTheDocument(); // shortAvg 92.8
    expect(dots.at(-1)!.getAttribute("fill")).toBe(
      tick
        ?.getAttribute("style")
        ?.match(/background-color:\s*([^;]+)/)?.[1]
        .trim(),
    );
  });

  it("one verdict per question: last night's word and the week's colour", () => {
    // suppressedDriftView is the case that used to split the pair: today is
    // suppressed AND the week is suppressed, and both must say so in their own
    // register — the dot for the night, the delta figure for the week.
    const { container } = renderTile(suppressedDriftView());
    const balance = within(view(container, "balance"));
    const trend = within(view(container, "trend"));

    expect(balance.getByText("Suppressed")).toBeInTheDocument();
    expect(trend.getByText(/16%/)).toHaveStyle({ color: "var(--warning)" });
    // The week's figure is the SAME figure on both views: 77 ms.
    expect(balance.getByText("77")).toBeInTheDocument();
    expect(trend.getByText("−14.2 ms")).toBeInTheDocument();
  });

  it("calibrating: one honest progress state for the whole tile, and no pager", () => {
    const { container } = renderTile(calibratingView());
    expect(screen.getByText(/9 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
    // Nothing to page between until there is a band.
    expect(screen.queryByRole("button", { name: "Next view" })).not.toBeInTheDocument();
  });

  it("legacy payload: the one guard holds for both views, nothing throws", () => {
    const { container } = renderTile(legacyView());
    expect(screen.getByText(/0 of 14/)).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});
