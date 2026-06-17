/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";

// The page is a thin three-column shell; stub the children to testids so this
// test asserts layout/composition without pulling in their data fetching.
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth", () => ({ getToken: () => "t" }));
vi.mock("./_components/YourWeekRail", () => ({
  YourWeekRail: () => <div data-testid="your-week" />,
}));
vi.mock("./_components/TimelineFeed", () => ({
  TimelineFeed: () => <div data-testid="feed" />,
}));
vi.mock("./_components/DiscoveryRail", () => ({
  DiscoveryRail: () => <div data-testid="discovery" />,
}));

import TimelinePage from "./page";

it("renders the three-column dashboard regions", () => {
  render(<TimelinePage />);
  expect(screen.getByTestId("your-week")).toBeInTheDocument();
  expect(screen.getByTestId("feed")).toBeInTheDocument();
  expect(screen.getByTestId("discovery")).toBeInTheDocument();
});
