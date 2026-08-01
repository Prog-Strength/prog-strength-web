/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { BpAbout } from "./bp-about";

describe("BpAbout", () => {
  it("renders the not-medical-advice closing line", () => {
    render(<BpAbout />);
    expect(screen.getByText(/not medical advice/i)).toBeInTheDocument();
  });

  it("renders all five category labels", () => {
    render(<BpAbout />);
    for (const label of ["Normal", "Elevated", "Stage 1", "Stage 2", "Crisis"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
