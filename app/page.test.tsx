/// <reference types="vitest/globals" />

import { render } from "@testing-library/react";
import Home from "./page";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const isAuthenticatedMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  isAuthenticated: isAuthenticatedMock,
}));

describe("Home (root redirect)", () => {
  beforeEach(() => {
    replaceMock.mockReset();
    isAuthenticatedMock.mockReset();
  });

  it("redirects an authenticated user to /dashboard", () => {
    isAuthenticatedMock.mockReturnValue(true);
    render(<Home />);
    expect(replaceMock).toHaveBeenCalledWith("/dashboard");
  });

  it("redirects an unauthenticated user to /login", () => {
    isAuthenticatedMock.mockReturnValue(false);
    render(<Home />);
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
