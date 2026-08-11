/// <reference types="vitest/globals" />

import { act, render, screen, within } from "@testing-library/react";

const getWhoopConnectionMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getWhoopConnection: getWhoopConnectionMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
}));

import { SleepCard, SleepTile } from "./sleep-tile";
import { noDataView, partialNightView, scoredNightView } from "./fixtures";
import type { SleepStage } from "./shared";

const HREF = "/recovery";

/**
 * The scored fixture's legend row, stage by stage: 1h 32m deep, 3h 55m light,
 * 1h 56m REM, 42m awake. LITERALS, deliberately not `formatSleepDuration` over
 * the fixture — a test that reruns the component's own formatter compares it to
 * itself and would keep passing if both stopped printing a duration at all.
 */
const STAGE_DURATIONS: [SleepStage, string, string][] = [
  ["slowWave", "Deep", "1h 32m"],
  ["light", "Light", "3h 55m"],
  ["rem", "REM", "1h 56m"],
  ["awake", "Awake", "42m"],
];

/** One stage's legend entry — the swatch, its word, and its duration. */
function legendItem(container: HTMLElement, stage: SleepStage): HTMLElement {
  const item = container.querySelector<HTMLElement>(`[data-stage-legend="${stage}"]`);
  if (!item) throw new Error(`no legend entry for ${stage}`);
  return item;
}

/**
 * Flush the connection read and the state update it schedules.
 *
 * Every assertion below that the reconnect prompt is ABSENT has to run AFTER
 * the tile has decided, or it passes on the first paint — before the read
 * resolves — and would keep passing however wrong the decision turns out to be.
 * `waitFor(…toHaveBeenCalled())` is not enough: the call happens in the effect,
 * one microtask ahead of the setState that acts on its answer.
 */
async function settleConnectionRead() {
  await act(async () => {});
  expect(getWhoopConnectionMock).toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  getWhoopConnectionMock.mockResolvedValue({ status: "connected", missing_scopes: [] });
});

describe("SleepCard", () => {
  it("heroes last night's asleep duration against Whoop's computed need", () => {
    render(<SleepCard section={scoredNightView()} href={HREF} />);
    expect(screen.getByRole("heading", { name: "Sleep" })).toBeInTheDocument();
    // 8h 05m in bed − 42m awake − 0 no-data = 7h 23m, against a need of
    // 8h 00m + 20m + 12m − 15m = 8h 17m.
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.getByText(/of 8h 17m need/)).toBeInTheDocument();
  });

  it("prints the sleep performance percentage as the qualifier", () => {
    render(<SleepCard section={scoredNightView()} href={HREF} />);
    expect(screen.getByText("89%")).toBeInTheDocument();
  });

  it("draws the stacked stage bar with a legend naming every stage", () => {
    const { container } = render(<SleepCard section={scoredNightView()} href={HREF} />);
    expect(container.querySelectorAll("[data-stage]")).toHaveLength(4);
    for (const word of ["Deep", "Light", "REM", "Awake"]) {
      expect(screen.getByText(word)).toBeInTheDocument();
    }
  });

  it("prints every stage's duration in the legend, not behind a pointer", () => {
    // The regression this pins: the bar's segments carry their durations in a
    // `title`, which only a pointer ever sees. A keyboard-only sighted user has
    // to be able to read the same four numbers WITHOUT hovering and without
    // spending a tab stop inside the tile's link — so they are printed.
    const { container } = render(<SleepCard section={scoredNightView()} href={HREF} />);
    for (const [stage, word, duration] of STAGE_DURATIONS) {
      const item = legendItem(container, stage);
      expect(within(item).getByText(word)).toBeInTheDocument();
      expect(within(item).getByText(duration)).toBeInTheDocument();
    }
    // No focusable segment or legend chip was added to get them there.
    expect(container.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("the legend keeps a stage the night has no reading for, as an em dash", () => {
    // A key whose entries come and go is a key nobody learns, and "Whoop sent
    // no deep-sleep figure" is a different fact from "no deep sleep".
    const { container } = render(<SleepCard section={partialNightView()} href={HREF} />);
    expect(within(legendItem(container, "slowWave")).getByText("—")).toBeInTheDocument();
    expect(within(legendItem(container, "awake")).getByText("—")).toBeInTheDocument();
    expect(within(legendItem(container, "light")).getByText("4h 0m")).toBeInTheDocument();
    expect(container.innerHTML).not.toContain("NaN");
  });

  it("links into the recovery page, the tile's interim deep link", () => {
    render(<SleepCard section={scoredNightView()} href={HREF} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", HREF);
  });

  it("a scored-but-partial night prints em dashes, never NaN", () => {
    const { container } = render(<SleepCard section={partialNightView()} href={HREF} />);
    // No awake reading → no asleep figure; a need with a hole → no need
    // figure; no performance percentage either. FOUR figures degrade — those
    // two, plus the two stages the legend still prints with no reading behind
    // them — and the test names each: "something printed an em dash" would pass
    // with the hero intact and the performance figure silently gone.
    expect(screen.getAllByText("—")).toHaveLength(4);
    expect(screen.getByText("asleep").previousElementSibling).toHaveTextContent("—");
    expect(screen.getByText("performance").previousElementSibling).toHaveTextContent("—");
    expect(container.innerHTML).not.toContain("NaN");
    expect(screen.queryByText(/need/)).not.toBeInTheDocument();
  });

  it("a non-finite performance percentage degrades too, rather than printing NaN%", () => {
    const view = scoredNightView();
    const { container } = render(
      <SleepCard
        section={{ ...view, lastNight: { ...view.lastNight!, performancePct: Number.NaN } }}
        href={HREF}
      />,
    );
    expect(screen.getByText("performance").previousElementSibling).toHaveTextContent("—");
    expect(container.innerHTML).not.toContain("NaN");
    // The rest of the night is unaffected — one bad field, not a dead tile.
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
  });

  it("no night yet renders the tile's own empty state, not an error", () => {
    const { container } = render(<SleepCard section={noDataView()} href={HREF} />);
    expect(screen.getByRole("heading", { name: "Sleep" })).toBeInTheDocument();
    expect(screen.getByText(/Wear your Whoop overnight/)).toBeInTheDocument();
    expect(container.querySelectorAll("[data-stage]")).toHaveLength(0);
  });
});

describe("SleepTile — the three states, in order", () => {
  it("renders the card when the connection is connected and fully scoped", async () => {
    render(<SleepTile section={{ present: true, ...scoredNightView() }} href={HREF} />);
    await settleConnectionRead();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.queryByText(/Reconnect/)).not.toBeInTheDocument();
  });

  it("an under-scoped connection gets the reconnect affordance, ahead of `present`", async () => {
    // The section IS present for an under-scoped connection — it is simply
    // empty forever. Checking `present` first would render the ordinary empty
    // state and the user would wait for data that is never coming.
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      missing_scopes: ["read:sleep"],
    });
    render(<SleepTile section={{ present: true, ...noDataView() }} href={HREF} />);
    expect(await screen.findByText(/Reconnect to enable sleep/)).toBeInTheDocument();
    expect(screen.queryByText(/Wear your Whoop overnight/)).not.toBeInTheDocument();
    // The tile is a signpost; the control lives in Settings.
    expect(screen.getByRole("link")).toHaveAttribute("href", "/settings?tab=integrations");
    // Product terms only — `read:sleep` is not a user-facing noun.
    expect(screen.queryByText(/read:sleep/)).not.toBeInTheDocument();
  });

  it("a connection missing an UNRELATED scope still shows the night it has", async () => {
    // Sleep ingests fine for this user — only the workout path is skipped —
    // so replacing a fully scored night with a prompt to enable sleep
    // tracking they already have would be a lie the user cannot dismiss.
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      missing_scopes: ["read:workout"],
    });
    render(<SleepTile section={{ present: true, ...scoredNightView() }} href={HREF} />);
    await settleConnectionRead();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.queryByText(/Reconnect/)).not.toBeInTheDocument();
  });

  it("renders nothing at all when there is no connection", () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
    const { container } = render(<SleepTile section={{ present: false }} href={HREF} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("a failed connection read never hides real data behind a reconnect prompt", async () => {
    getWhoopConnectionMock.mockRejectedValue(new Error("boom"));
    render(<SleepTile section={{ present: true, ...scoredNightView() }} href={HREF} />);
    await settleConnectionRead();
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
    expect(screen.queryByText(/Reconnect/)).not.toBeInTheDocument();
  });

  it("shows the data while the connection read is still in flight", () => {
    getWhoopConnectionMock.mockReturnValue(new Promise(() => {}));
    render(<SleepTile section={{ present: true, ...scoredNightView() }} href={HREF} />);
    // No skeleton flash in front of a night the user already has.
    expect(screen.getByText("7h 23m")).toBeInTheDocument();
  });

  it("an under-scoped connection whose status is error is left to Settings", async () => {
    // `missing_scopes` on a broken connection is not the story — the error is,
    // and Settings owns that copy. Same ordering the Settings row pins.
    getWhoopConnectionMock.mockResolvedValue({ status: "error", missing_scopes: ["read:sleep"] });
    render(<SleepTile section={{ present: true, ...scoredNightView() }} href={HREF} />);
    await settleConnectionRead();
    expect(screen.queryByText(/Reconnect to enable sleep/)).not.toBeInTheDocument();
  });
});
