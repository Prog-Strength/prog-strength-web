/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --- module mocks ----------------------------------------------------------

const clearTokenMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const useProfileMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  usePathname: () => "/chat",
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/profile-context", () => ({
  useProfile: useProfileMock,
}));

import { Sidebar } from "./sidebar";

// --- helpers ---------------------------------------------------------------

function profileCtx(over: Record<string, unknown> = {}) {
  return {
    profile: {
      id: "u1",
      email: "lifter@example.com",
      display_name: "Sam Lifter",
      weight_unit: "lb",
      distance_unit: "mi",
      height_cm: 180,
      avatar_url: null,
    },
    loading: false,
    error: null,
    refresh: vi.fn(),
    update: vi.fn(),
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  useProfileMock.mockReturnValue(profileCtx());
});

describe("Sidebar — account anchor", () => {
  it("renders the display name and an initials placeholder when no avatar", () => {
    render(<Sidebar />);
    expect(screen.getByText("Sam Lifter")).toBeInTheDocument();
    expect(screen.getByText("SL")).toBeInTheDocument();
  });

  it("renders the avatar image when avatar_url is set", () => {
    useProfileMock.mockReturnValue(
      profileCtx({
        profile: {
          ...profileCtx().profile,
          avatar_url: "https://signed.example/a.png",
        },
      }),
    );
    render(<Sidebar />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://signed.example/a.png");
  });

  it("opens the menu with Sign out and toggles aria-expanded", () => {
    render(<Sidebar />);
    const trigger = screen.getByRole("button", { name: "Account" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /sign out/i })).toBeInTheDocument();
  });

  it("Sign out clears the token and routes to /login", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /sign out/i }));
    expect(clearTokenMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });

  it("closes the menu on Escape", async () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
  });

  it("renders all 12 nav destinations", () => {
    render(<Sidebar />);
    for (const label of [
      "Chat",
      "Timeline",
      "Search",
      "Requests",
      "Activities",
      "Exercises",
      "Calendar",
      "Nutrition",
      "Bodyweight",
      "Progress",
      "Personal Records",
      "Settings",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument();
    }
  });

  it("marks the active route with aria-current", () => {
    render(<Sidebar />);
    expect(screen.getByRole("link", { name: "Chat" })).toHaveAttribute("aria-current", "page");
  });

  it("shows the user email as the account secondary line", () => {
    render(<Sidebar />);
    expect(screen.getByText("lifter@example.com")).toBeInTheDocument();
  });

  it("collapsed: renders avatar only but the menu still opens", async () => {
    localStorage.setItem("ps_sidebar_collapsed", "true");
    render(<Sidebar />);
    // Wait for the collapse-restore effect.
    await waitFor(() => expect(screen.queryByText("Sam Lifter")).not.toBeInTheDocument());
    // Initials placeholder still present (the avatar).
    expect(screen.getByText("SL")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Account" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });
});
