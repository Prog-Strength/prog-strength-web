/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ResolvedProfile } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const getMeMock = vi.hoisted(() => vi.fn());
const updateMeMock = vi.hoisted(() => vi.fn());
const uploadAvatarMock = vi.hoisted(() => vi.fn());
const deleteAvatarMock = vi.hoisted(() => vi.fn());
const clearTokenMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getMe: getMeMock,
  updateMe: updateMeMock,
  uploadAvatar: uploadAvatarMock,
  deleteAvatar: deleteAvatarMock,
}));

import { ProfileProvider, useProfile } from "./profile-context";

// --- helpers ---------------------------------------------------------------

function profile(over: Partial<ResolvedProfile> = {}): ResolvedProfile {
  return {
    id: "u1",
    email: "lifter@example.com",
    display_name: "Sam",
    weight_unit: "lb",
    distance_unit: "mi",
    height_cm: 180,
    avatar_url: null,
    timezone: "America/Denver",
    calendar_default_detail: "time_block",
    username: "sam",
    ...over,
  };
}

// A tiny consumer that surfaces the context for assertions and exposes
// buttons that drive the mutators.
function Harness() {
  const { profile: p, loading, error, update, uploadAvatar, removeAvatar } = useProfile();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="error">{error ?? ""}</span>
      <span data-testid="name">{p?.display_name ?? ""}</span>
      <span data-testid="avatar">{p?.avatar_url ?? ""}</span>
      <button onClick={() => void update({ display_name: "Sammy" })}>update</button>
      <button onClick={() => void uploadAvatar(new File(["x"], "a.png", { type: "image/png" }))}>
        upload
      </button>
      <button onClick={() => void removeAvatar()}>remove</button>
    </div>
  );
}

function renderHarness() {
  return render(
    <ProfileProvider>
      <Harness />
    </ProfileProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ProfileProvider", () => {
  it("fetches the profile on mount", async () => {
    getMeMock.mockResolvedValue(profile());
    renderHarness();

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Sam"));
    expect(getMeMock).toHaveBeenCalledWith("test-token");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("reflects the new display_name after update()", async () => {
    getMeMock.mockResolvedValue(profile());
    updateMeMock.mockResolvedValue(profile({ display_name: "Sammy" }));
    renderHarness();

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Sam"));
    fireEvent.click(screen.getByText("update"));

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Sammy"));
    expect(updateMeMock).toHaveBeenCalledWith("test-token", { display_name: "Sammy" });
  });

  it("swaps avatar_url after uploadAvatar()", async () => {
    getMeMock.mockResolvedValue(profile());
    uploadAvatarMock.mockResolvedValue(profile({ avatar_url: "https://signed.example/a.png" }));
    renderHarness();

    await waitFor(() => expect(screen.getByTestId("name")).toHaveTextContent("Sam"));
    fireEvent.click(screen.getByText("upload"));

    await waitFor(() =>
      expect(screen.getByTestId("avatar")).toHaveTextContent("https://signed.example/a.png"),
    );
    expect(uploadAvatarMock).toHaveBeenCalled();
  });

  it("clears avatar_url after removeAvatar()", async () => {
    getMeMock.mockResolvedValue(profile({ avatar_url: "https://signed.example/a.png" }));
    deleteAvatarMock.mockResolvedValue(profile({ avatar_url: null }));
    renderHarness();

    await waitFor(() =>
      expect(screen.getByTestId("avatar")).toHaveTextContent("https://signed.example/a.png"),
    );
    fireEvent.click(screen.getByText("remove"));

    await waitFor(() => expect(screen.getByTestId("avatar")).toHaveTextContent(""));
    expect(deleteAvatarMock).toHaveBeenCalledWith("test-token");
  });

  it("sets the error state when the initial fetch fails", async () => {
    getMeMock.mockRejectedValue(new Error("boom"));
    renderHarness();

    await waitFor(() => expect(screen.getByTestId("error")).toHaveTextContent("boom"));
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });

  it("clears the token and routes to /login on a 401", async () => {
    getMeMock.mockRejectedValue(new Error("HTTP 401"));
    renderHarness();

    await waitFor(() => expect(clearTokenMock).toHaveBeenCalled());
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
