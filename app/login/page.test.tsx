/// <reference types="vitest/globals" />

import { render, screen } from "@testing-library/react";
import LoginPage from "./page";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const isAuthenticatedMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

// config defaults to apiUrl = http://localhost:8080; jsdom's origin is
// http://localhost:3000, so the composed OAuth href is deterministic.
const EXPECTED_HREF =
  "http://localhost:8080/auth/google/login?return_to=" +
  encodeURIComponent("http://localhost:3000/auth/callback");

describe("LoginPage (landing)", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    isAuthenticatedMock.mockReset();
    isAuthenticatedMock.mockReturnValue(false);
  });

  it("renders the brand lockup, the AI-logging headline, and a primary CTA", () => {
    render(<LoginPage />);
    expect(screen.getByText("Prog Strength")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /tell it what you trained/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /continue with google/i }).length).toBeGreaterThan(
      0,
    );
  });

  it("renders the full alternating feature-row stack (chat, nutrition, workouts, calendar)", () => {
    render(<LoginPage />);
    expect(screen.getByText("AI coach")).toBeInTheDocument();
    expect(screen.getByText("Nutrition & macros")).toBeInTheDocument();
    expect(screen.getByText("Workouts & PRs")).toBeInTheDocument();
    expect(screen.getByText("Calendar & progress")).toBeInTheDocument();

    // The chat proof row renders its macro table with the Total row.
    expect(screen.getByText("Columbus Turkey Burger")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
  });

  it("composes the OAuth href once return_to resolves, on both the top and bottom CTAs", () => {
    render(<LoginPage />);
    const ctas = screen.getAllByRole("link", { name: /continue with google/i });
    // CTA repeated top + bottom — but it's one auth path, same href.
    expect(ctas).toHaveLength(2);
    ctas.forEach((cta) => {
      expect(cta).toHaveAttribute("href", EXPECTED_HREF);
      expect(cta).toHaveAttribute("aria-disabled", "false");
    });

    // Both CTAs keep the Google glyph and the reassurance line.
    expect(ctas[0].querySelector("svg")).toBeInTheDocument();
    expect(ctas[1].querySelector("svg")).toBeInTheDocument();
    expect(screen.getAllByText(/no password to manage\./i)).toHaveLength(2);
  });

  it("redirects an already-signed-in visitor to /chat instead of showing the landing", () => {
    isAuthenticatedMock.mockReturnValue(true);
    render(<LoginPage />);
    expect(replaceMock).toHaveBeenCalledWith("/chat");
  });
});
