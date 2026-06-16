/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { UsageSnapshot } from "@/lib/usage-context";
import type { ResolvedProfile } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const useUsageMock = vi.hoisted(() => vi.fn());
const useProfileMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const getCalendarConnectionMock = vi.hoisted(() => vi.fn());
const disconnectCalendarMock = vi.hoisted(() => vi.fn());
const checkUsernameAvailableMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCalendarConnection: getCalendarConnectionMock,
  disconnectCalendar: disconnectCalendarMock,
  checkUsernameAvailable: checkUsernameAvailableMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({ unit: "mi", setUnit: vi.fn() }),
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({
    success: toastSuccessMock,
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

vi.mock("@/lib/usage-context", () => ({
  useUsage: useUsageMock,
}));

vi.mock("@/lib/profile-context", () => ({
  useProfile: useProfileMock,
}));

import SettingsPage from "./page";

// --- helpers ---------------------------------------------------------------

function snapshot(
  over: Partial<UsageSnapshot> = {},
): UsageSnapshot & { refresh: () => Promise<void> } {
  return {
    percentUsed: 0,
    capped: false,
    // ~5h out so the countdown copy is non-trivial.
    resetsAt: new Date(Date.now() + 5 * 60 * 60 * 1000),
    loading: false,
    error: null,
    refresh: vi.fn(async () => {}),
    ...over,
  };
}

const updateMock = vi.fn(async () => profile());
const uploadAvatarMock = vi.fn(async () => profile());
const removeAvatarMock = vi.fn(async () => profile());

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
    bio: null,
    ...over,
  };
}

function profileCtx(over: Partial<ResolvedProfile> = {}) {
  return {
    profile: profile(over),
    loading: false,
    error: null,
    refresh: vi.fn(),
    update: updateMock,
    uploadAvatar: uploadAvatarMock,
    removeAvatar: removeAvatarMock,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProfileMock.mockReturnValue(profileCtx());
  useUsageMock.mockReturnValue(snapshot());
  // Default: no calendar connection (so existing tests' "Connect" affordance
  // is harmless and the connection fetch resolves rather than hitting fetch).
  getCalendarConnectionMock.mockResolvedValue({ status: "absent" });
  disconnectCalendarMock.mockResolvedValue(undefined);
  // Default: a free handle. Tests that need "taken" override per-case.
  checkUsernameAvailableMock.mockResolvedValue(true);
});

function progressFill(): HTMLElement {
  return screen.getByRole("progressbar", { name: "Daily AI allowance" });
}

describe("Settings — Usage section", () => {
  it("renders a 0% accent bar", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 0 }));
    render(<SettingsPage />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    const fill = progressFill();
    expect(fill).toHaveStyle({ width: "0%" });
    expect(fill.style.backgroundColor).toBe("var(--accent)");
    expect(screen.getByText(/Resets in/)).toBeInTheDocument();
  });

  it("renders a 50% accent bar", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 50 }));
    render(<SettingsPage />);
    expect(screen.getByText("50%")).toBeInTheDocument();
    const fill = progressFill();
    expect(fill).toHaveStyle({ width: "50%" });
    expect(fill.style.backgroundColor).toBe("var(--accent)");
  });

  it("renders an amber bar at 80%", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 80 }));
    render(<SettingsPage />);
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(progressFill().style.backgroundColor).toBe("var(--warning)");
  });

  it("renders a red bar at 100% with the flipped copy", () => {
    useUsageMock.mockReturnValue(snapshot({ percentUsed: 100, capped: true }));
    render(<SettingsPage />);
    expect(screen.getByText("100%")).toBeInTheDocument();
    expect(progressFill().style.backgroundColor).toBe("var(--danger)");
    expect(screen.getByText(/You've used your daily AI allowance/)).toBeInTheDocument();
    expect(screen.queryByText(/^Resets in/)).not.toBeInTheDocument();
  });

  it("renders a disabled bar with the unavailable copy on error", () => {
    useUsageMock.mockReturnValue(snapshot({ error: "boom" }));
    render(<SettingsPage />);
    expect(screen.getByText("Usage unavailable right now.")).toBeInTheDocument();
    // The progress bar is replaced by a hatched/disabled track on error.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("usage-bar-unavailable")).toBeInTheDocument();
  });
});

describe("Settings — Profile section", () => {
  it("renders the current display name", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText("Display name")).toHaveValue("Sam");
  });

  it("saves an edited display name via update()", async () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Display name");
    fireEvent.change(input, { target: { value: "Sammy" } });
    // The display-name row's Save button is the first of the two Save
    // buttons (name, then height).
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[0]);
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ display_name: "Sammy" }));
  });

  it("shows the required error and skips update() on an empty display name", async () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Display name");
    // Clearing the seeded "Sam" makes the row dirty (so Save is enabled)
    // but the trimmed value is empty → the inline required guard fires.
    fireEvent.change(input, { target: { value: "" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[0]);
    await waitFor(() => expect(screen.getByText("Display name is required.")).toBeInTheDocument());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("shows the server error inline when update() rejects with a 400", async () => {
    // Simulate the api layer surfacing a server 400 as a thrown Error; the
    // row's catch should render its message inline rather than swallow it.
    updateMock.mockRejectedValueOnce(new Error("Display name already taken"));
    render(<SettingsPage />);
    const input = screen.getByLabelText("Display name");
    fireEvent.change(input, { target: { value: "Sammy" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[0]);
    await waitFor(() => expect(screen.getByText("Display name already taken")).toBeInTheDocument());
    expect(updateMock).toHaveBeenCalledWith({ display_name: "Sammy" });
  });

  it("displays height in inches when distance unit is miles", () => {
    // 180 cm / 2.54 = 70.9 in.
    render(<SettingsPage />);
    expect(screen.getByLabelText("Height (in)")).toHaveValue(70.9);
  });

  it("displays height in centimeters when distance unit is km", () => {
    useProfileMock.mockReturnValue(profileCtx({ distance_unit: "km", height_cm: 180 }));
    render(<SettingsPage />);
    expect(screen.getByLabelText("Height (cm)")).toHaveValue(180);
  });

  it("shows 'No height set.' when height is null", () => {
    useProfileMock.mockReturnValue(profileCtx({ height_cm: null }));
    render(<SettingsPage />);
    expect(screen.getByText("No height set.")).toBeInTheDocument();
  });

  it("saves height converted from inches to cm", async () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Height (in)");
    fireEvent.change(input, { target: { value: "72" } });
    // Save buttons render in DOM order: display name, username, bio, height.
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[3]);
    // 72 in * 2.54 = 182.88 → rounded to 182.9.
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ height_cm: 182.9 }));
  });

  it("renders an initials placeholder when no avatar is set", () => {
    render(<SettingsPage />);
    // Single-word name "Sam" → first two letters "SA".
    expect(screen.getByText("SA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("renders the avatar image and a Remove button when set", () => {
    useProfileMock.mockReturnValue(profileCtx({ avatar_url: "https://signed.example/a.png" }));
    render(<SettingsPage />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://signed.example/a.png");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("removes the avatar via removeAvatar()", async () => {
    useProfileMock.mockReturnValue(profileCtx({ avatar_url: "https://signed.example/a.png" }));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeAvatarMock).toHaveBeenCalled());
  });

  it("rejects an oversized file and skips the upload", async () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText("Upload avatar");
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 3 * 1024 * 1024 });
    fireEvent.change(fileInput, { target: { files: [big] } });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Image must be under 2 MB."));
    expect(uploadAvatarMock).not.toHaveBeenCalled();
  });

  it("rejects a non-image file and skips the upload", async () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText("Upload avatar");
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdf] } });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Use PNG, JPG, or WebP."));
    expect(uploadAvatarMock).not.toHaveBeenCalled();
  });

  it("uploads a valid image via uploadAvatar()", async () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText("Upload avatar");
    const png = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [png] } });
    await waitFor(() => expect(uploadAvatarMock).toHaveBeenCalledWith(png));
  });
});

describe("Settings — Google Calendar section", () => {
  it("shows Connect Google Calendar when the connection is absent", async () => {
    getCalendarConnectionMock.mockResolvedValue({ status: "absent" });
    render(<SettingsPage />);
    expect(
      await screen.findByRole("button", { name: "Connect Google Calendar" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect" })).not.toBeInTheDocument();
  });

  it("shows Disconnect when the calendar is connected", async () => {
    getCalendarConnectionMock.mockResolvedValue({ status: "connected" });
    render(<SettingsPage />);
    expect(await screen.findByRole("button", { name: "Disconnect" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect Google Calendar" }),
    ).not.toBeInTheDocument();
  });

  it("disconnects via disconnectCalendar() and refreshes", async () => {
    getCalendarConnectionMock.mockResolvedValueOnce({ status: "connected" });
    getCalendarConnectionMock.mockResolvedValueOnce({ status: "revoked" });
    render(<SettingsPage />);
    const btn = await screen.findByRole("button", { name: "Disconnect" });
    fireEvent.click(btn);
    await waitFor(() => expect(disconnectCalendarMock).toHaveBeenCalled());
    // After disconnecting it re-reads the (now revoked) connection and flips
    // back to the Connect affordance.
    expect(
      await screen.findByRole("button", { name: "Connect Google Calendar" }),
    ).toBeInTheDocument();
  });

  it("changes the default-detail control via update()", async () => {
    render(<SettingsPage />);
    // Profile fixture defaults to "time_block"; click "Full agenda".
    const fullAgenda = await screen.findByRole("button", { name: "Full agenda" });
    fireEvent.click(fullAgenda);
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({ calendar_default_detail: "full_agenda" }),
    );
  });
});

describe("Settings — Bio row", () => {
  it("renders the current bio", () => {
    useProfileMock.mockReturnValue(profileCtx({ bio: "Lifts heavy things." }));
    render(<SettingsPage />);
    expect(screen.getByLabelText("Bio")).toHaveValue("Lifts heavy things.");
  });

  it("shows the rune counter and caps input at 160 runes", () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Bio");
    // 200-char input gets trimmed to 160; the counter reflects the cap.
    fireEvent.change(input, { target: { value: "a".repeat(200) } });
    expect(input).toHaveValue("a".repeat(160));
    expect(screen.getByText("160/160")).toBeInTheDocument();
  });

  it("disables Save when the textarea equals the persisted bio", () => {
    useProfileMock.mockReturnValue(profileCtx({ bio: "Same bio" }));
    render(<SettingsPage />);
    // No edit yet → the bio row's Save (third Save button) is disabled.
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    expect(saveButtons[2]).toBeDisabled();
  });

  it("saves an edited bio via update()", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "New bio" } });
    // Save buttons in DOM order: display name, username, bio, height.
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[2]);
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ bio: "New bio" }));
  });

  it("clears the bio by sending an empty string", async () => {
    useProfileMock.mockReturnValue(profileCtx({ bio: "Old bio" }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "" } });
    const saveButtons = screen.getAllByRole("button", { name: "Save" });
    fireEvent.click(saveButtons[2]);
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ bio: "" }));
  });
});

describe("Settings — Username row", () => {
  // The username row's own Save button is the second of the three Save
  // buttons (display name, username, height).
  function usernameSave(): HTMLElement {
    return screen.getAllByRole("button", { name: "Save" })[1];
  }

  it("renders the current username", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText("Username")).toHaveValue("sam");
  });

  it("shows the charset hint, disables Save, and skips probe on an invalid handle", async () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Username");
    // Leading digit + uppercase → fails the ^[a-z][a-z0-9_]{2,29}$ rule.
    fireEvent.change(input, { target: { value: "1Bad" } });
    // The inline charset hint renders immediately for invalid, dirty input.
    await waitFor(() =>
      expect(screen.getByText(/3–30 characters: start with a letter/)).toBeInTheDocument(),
    );
    // Save is disabled (can't be clicked) and no availability probe fires.
    expect(usernameSave()).toBeDisabled();
    expect(updateMock).not.toHaveBeenCalled();
    expect(checkUsernameAvailableMock).not.toHaveBeenCalled();
  });

  it("debounce-probes and shows 'available' for a free, valid handle", async () => {
    checkUsernameAvailableMock.mockResolvedValue(true);
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newhandle" } });
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "newhandle"),
    );
    await waitFor(() => expect(screen.getByText("@newhandle is available.")).toBeInTheDocument());
  });

  it("shows 'taken' and disables Save when the handle is taken", async () => {
    checkUsernameAvailableMock.mockResolvedValue(false);
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "occupied" } });
    await waitFor(() => expect(screen.getByText("@occupied is taken.")).toBeInTheDocument());
    expect(usernameSave()).toBeDisabled();
  });

  it("lowercases input and saves via update(), toasting success", async () => {
    checkUsernameAvailableMock.mockResolvedValue(true);
    render(<SettingsPage />);
    // Uppercase entry is normalized to lowercase before save + probe.
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "NewSam" } });
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "newsam"),
    );
    fireEvent.click(usernameSave());
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ username: "newsam" }));
    await waitFor(() => expect(toastSuccessMock).toHaveBeenCalledWith("Username updated."));
  });

  it("surfaces a server 409 inline and via toast", async () => {
    checkUsernameAvailableMock.mockResolvedValue(true);
    updateMock.mockRejectedValueOnce(new Error("username already taken"));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "racey" } });
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "racey"),
    );
    fireEvent.click(usernameSave());
    await waitFor(() => expect(screen.getByText("username already taken")).toBeInTheDocument());
    expect(toastErrorMock).toHaveBeenCalledWith("username already taken");
  });
});
