/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import { GoogleCtaButton } from "./google-cta-button";

describe("GoogleCtaButton", () => {
  it("renders the OAuth href, the Google glyph, and the reassurance when ready", () => {
    const href =
      "https://api.example.com/auth/google/login?return_to=https%3A%2F%2Fapp%2Fauth%2Fcallback";
    render(<GoogleCtaButton loginHref={href} />);

    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("aria-disabled", "false");

    // Trust signals: the multicolor "G" glyph (an inline SVG) and the
    // "No password to manage." reassurance line.
    expect(link.querySelector("svg")).toBeInTheDocument();
    expect(screen.getByText(/no password to manage\./i)).toBeInTheDocument();
  });

  it("renders disabled and non-interactive before return_to resolves", () => {
    render(<GoogleCtaButton loginHref={null} />);

    const link = screen.getByRole("link", { name: /continue with google/i });
    expect(link).toHaveAttribute("aria-disabled", "true");
    // Falls back to "#" rather than a half-formed OAuth URL, and is taken
    // out of the tab order so it can't be activated in the not-ready beat.
    expect(link).toHaveAttribute("href", "#");
    expect(link).toHaveAttribute("tabindex", "-1");
    expect(link.className).toContain("pointer-events-none");
  });
});
