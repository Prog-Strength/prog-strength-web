/// <reference types="vitest/globals" />

import { act, render, screen } from "@testing-library/react";
import { LoadingBody, Spinner } from "./weather-loading";

describe("Spinner", () => {
  it("announces itself rather than being a decorative shape", () => {
    render(<Spinner />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("spins — the whole point is that something is visibly moving", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")?.getAttribute("class")).toContain("animate-spin");
  });
});

describe("LoadingBody", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says what is being waited on, and keeps the reading's shape", () => {
    const { container } = render(<LoadingBody startedAt={Date.now()} />);
    expect(screen.getByText("Checking conditions…")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
    // The skeleton still reserves the layout, so nothing jumps when data lands.
    expect(container.querySelector(".animate-pulse")).not.toBeNull();
  });

  it("admits it is slow once the wait passes the threshold", () => {
    render(<LoadingBody startedAt={Date.now()} />);
    expect(screen.getByText("Checking conditions…")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText(/Still fetching/)).toBeInTheDocument();
    expect(screen.queryByText("Checking conditions…")).not.toBeInTheDocument();
  });

  it("measures the FETCH, not the mount", () => {
    // Paging away and back remounts this body. A request that has genuinely
    // been in flight for ten seconds must not get a fresh two-second grace
    // period every time the user looks at it.
    render(<LoadingBody startedAt={Date.now() - 10_000} />);
    expect(screen.getByText(/Still fetching/)).toBeInTheDocument();
  });
});
