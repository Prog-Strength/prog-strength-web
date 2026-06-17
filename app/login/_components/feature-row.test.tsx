/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { FeatureRow } from "./feature-row";

function renderRow(index: number, tint: string | null) {
  return render(
    <FeatureRow
      index={index}
      eyebrow="Nutrition & macros"
      title="Macros tracked, not tallied by hand."
      body="Every logged meal rolls up into your daily rings."
      tint={tint}
      mock={<div data-testid="mock">mock</div>}
    />,
  );
}

describe("FeatureRow", () => {
  it("renders the eyebrow, title, body, and mock", () => {
    renderRow(1, "var(--macro-protein)");
    expect(screen.getByText("Nutrition & macros")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /macros tracked/i })).toBeInTheDocument();
    expect(screen.getByText(/every logged meal/i)).toBeInTheDocument();
    expect(screen.getByTestId("mock")).toBeInTheDocument();
  });

  it("collapses to a single column by default and splits to two at the md breakpoint", () => {
    const { container } = renderRow(1, "var(--macro-protein)");
    const section = container.querySelector("section") as HTMLElement;
    // Mobile-first: one column by default, two columns only at md+ — this is
    // the narrow-width reflow (rows stack, never break).
    expect(section.className).toContain("grid-cols-1");
    expect(section.className).toContain("md:grid-cols-2");
  });

  it("applies the row tint to the eyebrow on even (image-left) rows", () => {
    renderRow(0, "var(--macro-fat)");
    const eyebrow = screen.getByText("Nutrition & macros");
    expect(eyebrow).toHaveStyle({ color: "var(--macro-fat)" });
  });

  it("pushes the mock to the right on odd-index rows", () => {
    renderRow(1, "var(--macro-carb)");
    // The mock wrapper is the first grid child; on odd rows it's pushed to
    // the right via md:order-2 (and the copy column to md:order-1).
    const mockWrapper = screen.getByTestId("mock").parentElement as HTMLElement;
    expect(mockWrapper.className).toContain("md:order-2");
  });

  it("keeps the mock on the left on even-index rows", () => {
    renderRow(2, "var(--macro-carb)");
    const mockWrapper = screen.getByTestId("mock").parentElement as HTMLElement;
    expect(mockWrapper.className).not.toContain("md:order-2");
  });

  it("falls back to the violet accent when no tint is given (the chat row)", () => {
    renderRow(0, null);
    const eyebrow = screen.getByText("Nutrition & macros");
    expect(eyebrow).toHaveStyle({ color: "var(--accent)" });
  });
});
