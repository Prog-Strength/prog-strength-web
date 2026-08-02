/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { RecoveryConnectCard } from "./connect-card";
import {
  balancedView,
  calibratingView,
  legacyView,
  noReadingView,
  suppressedView,
} from "./fixtures";
import { ReadinessVerdictCard } from "./readiness-verdict";

const HREF = "/recovery";

describe("ReadinessVerdictCard", () => {
  it("suppressed: heroes the verdict sentence with the status word colored", () => {
    render(<ReadinessVerdictCard section={suppressedView()} href={HREF} />);
    const word = screen.getByText("Suppressed");
    expect(word).toBeInTheDocument();
    expect(word).toHaveStyle({ color: "var(--warning)" });
    // (74 − 91.2) / 91.2 → −19% vs baseline, spelled out in the sentence.
    expect(screen.getByText(/19% below/)).toBeInTheDocument();
  });

  it("suppressed: three contributor rows carry values and baseline-delta chips", () => {
    render(<ReadinessVerdictCard section={suppressedView()} href={HREF} />);
    expect(screen.getByText("Resting HR")).toBeInTheDocument();
    expect(screen.getByText("−1.4")).toBeInTheDocument(); // 51 vs 52.4
    expect(screen.getByText("−10")).toBeInTheDocument(); // 58 vs 68.1
    expect(screen.getByText("−17")).toBeInTheDocument(); // 74 vs 91.2
  });

  it("balanced: the ordinary day reads calm, with the verdict in success", () => {
    render(<ReadinessVerdictCard section={balancedView()} href={HREF} />);
    const word = screen.getByText("Balanced");
    expect(word).toHaveStyle({ color: "var(--success)" });
    expect(screen.getByText(/3% above/)).toBeInTheDocument();
  });

  it("calibrating: renders honest n-of-14 progress, not an empty frame", () => {
    render(<ReadinessVerdictCard section={calibratingView()} href={HREF} />);
    expect(screen.getByText(/9\s*of 14 nights/)).toBeInTheDocument();
    expect(screen.queryByText("NaN", { exact: false })).not.toBeInTheDocument();
  });

  it("no reading yet: a full true sentence from server baselines, never em-dashes", () => {
    render(<ReadinessVerdictCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText(/No reading yet today/)).toBeInTheDocument();
    // "52.4" shares a text node with its "bpm" unit suffix, so match the
    // substring within that node rather than an exact single-value match.
    expect(screen.getByText((_, el) => el?.textContent === "52.4 bpm")).toBeInTheDocument();
    expect(screen.getByText(/trending falling/)).toBeInTheDocument();
    // Yesterday is never promoted into today: no today-value figures render.
    expect(screen.queryByText("74")).not.toBeInTheDocument();
  });

  it("guards absent derived blocks with a calibrating body, never a crash", () => {
    render(<ReadinessVerdictCard section={legacyView()} href={HREF} />);
    expect(screen.getByText("Recovery is calibrating.")).toBeInTheDocument();
  });

  it("keeps the whole-card link into the deep page", () => {
    const { container } = render(<ReadinessVerdictCard section={suppressedView()} href={HREF} />);
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });
});

describe("RecoveryConnectCard", () => {
  it("renders the tile's own title over the shared connect CTA", () => {
    const { container } = render(<RecoveryConnectCard title="HRV Balance" href={HREF} />);
    expect(screen.getByRole("heading", { name: "HRV Balance" })).toBeInTheDocument();
    expect(screen.getByText("Connect Whoop to see recovery")).toBeInTheDocument();
    expect(container.querySelector("a")).toHaveAttribute("href", HREF);
  });
});
