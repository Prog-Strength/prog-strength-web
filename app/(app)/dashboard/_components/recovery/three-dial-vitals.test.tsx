/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { balancedView, calibratingView, noReadingView, suppressedView } from "./fixtures";
import { MorningVitalsCard } from "./three-dial-vitals";

const HREF = "/recovery";

describe("MorningVitalsCard", () => {
  it("suppressed: three equal cells with values and vs-30d delta captions", () => {
    render(<MorningVitalsCard section={suppressedView()} href={HREF} />);
    expect(screen.getByText("58")).toBeInTheDocument();
    expect(screen.getByText("51")).toBeInTheDocument();
    expect(screen.getByText(/74/)).toBeInTheDocument();
    expect(screen.getByText("vs 30d −10")).toBeInTheDocument();
    expect(screen.getByText("vs 30d −1.4")).toBeInTheDocument();
    expect(screen.getByText("vs 30d −17")).toBeInTheDocument();
  });

  it("exactly one status dot, beside HRV, in the status color", () => {
    const { container } = render(<MorningVitalsCard section={suppressedView()} href={HREF} />);
    const dots = container.querySelectorAll("span.h-1\\.5.w-1\\.5");
    expect(dots).toHaveLength(1);
    expect((dots[0] as HTMLElement).style.backgroundColor).toBe("var(--warning)");
  });

  it("balanced: the dot reads success and stays the only color", () => {
    const { container } = render(<MorningVitalsCard section={balancedView()} href={HREF} />);
    const dots = container.querySelectorAll("span.h-1\\.5.w-1\\.5");
    expect((dots[0] as HTMLElement).style.backgroundColor).toBe("var(--success)");
  });

  it("no reading yet: promotes the 30-day averages to primary figures", () => {
    render(<MorningVitalsCard section={noReadingView()} href={HREF} />);
    expect(screen.getByText(/No reading yet today/)).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument(); // recoveryScoreAvg 68.1
    expect(screen.getByText("52.4")).toBeInTheDocument(); // restingHrAvg
    expect(screen.getByText(/91/)).toBeInTheDocument(); // hrvAvg 91.2
    expect(screen.getAllByText("30d avg")).toHaveLength(3);
  });

  it("calibrating: cells show today's readings with calibrating captions, no NaN", () => {
    render(<MorningVitalsCard section={calibratingView()} href={HREF} />);
    expect(screen.getAllByText("calibrating")).toHaveLength(3);
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
  });
});
