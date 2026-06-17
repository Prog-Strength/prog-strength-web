/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { StatRow } from "./StatRow";

describe("StatRow", () => {
  it("renders each parsed stat's value and uppercase label", () => {
    render(<StatRow metrics={["5.0 mi · 41:12"]} />);
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText("mi")).toBeInTheDocument();
    expect(screen.getByText("41:12")).toBeInTheDocument();
  });

  it("renders nothing when there are no metrics", () => {
    const { container } = render(<StatRow metrics={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
