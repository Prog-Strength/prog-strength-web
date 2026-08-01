/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { UsageSnapshot } from "@/lib/usage-context";
import type { ResolvedProfile } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const useUsageMock = vi.hoisted(() => vi.fn());
const useProfileMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());
const toastSuccessMock = vi.hoisted(() => vi.fn());
const getCalendarConnectionMock = vi.hoisted(() => vi.fn());
const disconnectCalendarMock = vi.hoisted(() => vi.fn());
const getWhoopConnectionMock = vi.hoisted(() => vi.fn());
const disconnectWhoopMock = vi.hoisted(() => vi.fn());
const checkUsernameAvailableMock = vi.hoisted(() => vi.fn());
const setUnitMock = vi.hoisted(() => vi.fn());

// The active tab is read from ?tab=; tests drive it through this holder and
// switch to "integrations" before rendering the calendar/whoop cases.
const searchTab = vi.hoisted(() => ({ value: null as string | null }));
const routerReplaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock, push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(searchTab.value ? `tab=${searchTab.value}` : ""),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getCalendarConnection: getCalendarConnectionMock,
  disconnectCalendar: disconnectCalendarMock,
  getWhoopConnection: getWhoopConnectionMock,
  disconnectWhoop: disconnectWhoopMock,
  checkUsernameAvailable: checkUsernameAvailableMock,
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/distance-unit-context", () => ({
  useDistanceUnit: () => ({ unit: "mi", setUnit: setUnitMock }),
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
    birthdate: null,
    sex: null,
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

// jsdom implements no object-URL API; the avatar crop step needs one for its
// preview image.
beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:avatar");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  // Default tab is Profile; integration cases opt into ?tab=integrations.
  searchTab.value = null;
  useProfileMock.mockReturnValue(profileCtx());
  useUsageMock.mockReturnValue(snapshot());
  // Default: no calendar connection (so existing tests' "Connect" affordance
  // is harmless and the connection fetch resolves rather than hitting fetch).
  getCalendarConnectionMock.mockResolvedValue({ status: "absent" });
  disconnectCalendarMock.mockResolvedValue(undefined);
  getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
  disconnectWhoopMock.mockResolvedValue(undefined);
  // Default: a free handle. Tests that need "taken" override per-case.
  checkUsernameAvailableMock.mockResolvedValue(true);
  // update() resolves to the patched profile by default; cases that need a
  // specific re-baseline override per-case.
  updateMock.mockImplementation(async () => profile());
});

function progressFill(): HTMLElement {
  return screen.getByRole("progressbar", { name: "Daily AI allowance" });
}

function saveBar(): HTMLElement | null {
  return screen.queryByRole("region", { name: "Unsaved changes" });
}

// --- Usage section ----------------------------------------------------------

describe("Settings — Daily AI allowance", () => {
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
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByTestId("usage-bar-unavailable")).toBeInTheDocument();
  });
});

// --- Save bar dirty/count/discard/save -------------------------------------

describe("Settings — save bar", () => {
  it("shows no save bar when clean", () => {
    render(<SettingsPage />);
    expect(saveBar()).not.toBeInTheDocument();
  });

  it("shows the bar with a singular count after one edit", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Sammy" } });
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
  });

  it("shows a plural count after two edits", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Sammy" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "hi" } });
    expect(screen.getByText("2 unsaved changes")).toBeInTheDocument();
  });

  it("discards edits and hides the bar", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Sammy" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByLabelText("Display name")).toHaveValue("Sam");
    expect(screen.getByLabelText("Bio")).toHaveValue("");
    expect(saveBar()).not.toBeInTheDocument();
  });

  it("saves with one update() of only the changed keys, flashes, and retracts", async () => {
    updateMock.mockResolvedValueOnce(profile({ display_name: "Sammy", bio: "hi" }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Sammy" } });
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({ display_name: "Sammy", bio: "hi" }),
    );
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("All changes saved ✓")).toBeInTheDocument();
    // After re-baseline, no more "unsaved" copy.
    await waitFor(() => expect(screen.queryByText(/unsaved change/)).not.toBeInTheDocument());
  });

  it("disables Save with a reason when the display name is empty", () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "" } });
    expect(screen.getByText("Add a display name to save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("surfaces a save error via toast and keeps the bar up", async () => {
    updateMock.mockRejectedValueOnce(new Error("Display name already taken"));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "Sammy" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Display name already taken"));
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
  });
});

// --- Username gating --------------------------------------------------------

describe("Settings — username", () => {
  it("renders the current username", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText("Username")).toHaveValue("sam");
  });

  it("blocks Save with a charset hint for an invalid dirty handle, skipping probe", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "1bad" } });
    await waitFor(() =>
      expect(screen.getByText(/3–30 characters: start with a letter/)).toBeInTheDocument(),
    );
    expect(screen.getByText("Fix the username to save")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(checkUsernameAvailableMock).not.toHaveBeenCalled();
  });

  it("blocks Save while checking, then shows available and enables Save", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "newhandle" } });
    // While checking, Save is blocked with the reason.
    await waitFor(() => expect(screen.getByText("Fix the username to save")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "newhandle"),
    );
    await waitFor(() => expect(screen.getByText("@newhandle is available.")).toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  });

  it("shows taken and keeps Save disabled when the handle is taken", async () => {
    checkUsernameAvailableMock.mockResolvedValue(false);
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "occupied" } });
    await waitFor(() => expect(screen.getByText("@occupied is taken.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("lowercases input and saves a valid handle in the patch", async () => {
    updateMock.mockResolvedValueOnce(profile({ username: "newsam" }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "NewSam" } });
    expect(screen.getByLabelText("Username")).toHaveValue("newsam");
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "newsam"),
    );
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ username: "newsam" }));
  });
});

// --- Bio --------------------------------------------------------------------

describe("Settings — bio", () => {
  it("renders the current bio", () => {
    useProfileMock.mockReturnValue(profileCtx({ bio: "Lifts heavy things." }));
    render(<SettingsPage />);
    expect(screen.getByLabelText("Bio")).toHaveValue("Lifts heavy things.");
  });

  it("shows the rune counter and caps input at 160 runes incl. emoji", () => {
    render(<SettingsPage />);
    const input = screen.getByLabelText("Bio") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "😀".repeat(200) } });
    expect([...input.value].length).toBe(160);
    expect(screen.getByText("160/160")).toBeInTheDocument();
  });

  it("clears the bio by sending an empty string", async () => {
    useProfileMock.mockReturnValue(profileCtx({ bio: "Old bio" }));
    updateMock.mockResolvedValueOnce(profile({ bio: null }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Bio"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ bio: "" }));
  });
});

// --- Height -----------------------------------------------------------------

describe("Settings — height", () => {
  it("displays height in inches when distance unit is miles", () => {
    render(<SettingsPage />);
    expect(screen.getByLabelText("Height (in)")).toHaveValue(70.9);
  });

  it("displays height in centimeters when distance unit is km", () => {
    useProfileMock.mockReturnValue(profileCtx({ distance_unit: "km", height_cm: 180 }));
    render(<SettingsPage />);
    expect(screen.getByLabelText("Height (cm)")).toHaveValue(180);
  });

  it("shows an empty height field when height is null", () => {
    useProfileMock.mockReturnValue(profileCtx({ height_cm: null }));
    render(<SettingsPage />);
    expect(screen.getByLabelText("Height (in)")).toHaveValue(null);
  });

  it("saves height converted from inches to cm", async () => {
    updateMock.mockResolvedValueOnce(profile({ height_cm: 182.9 }));
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Height (in)"), { target: { value: "72" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ height_cm: 182.9 }));
  });

  it("aborts the save and toasts on an invalid height", async () => {
    render(<SettingsPage />);
    fireEvent.change(screen.getByLabelText("Height (in)"), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(toastErrorMock).toHaveBeenCalledWith("Enter a valid height, or leave blank to clear."),
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("re-expresses height when distance is flipped without marking height dirty", () => {
    render(<SettingsPage />);
    // 180cm shows as 70.9 in. Flipping to km re-expresses the display into cm
    // (~180, modulo the lossy 0.1 round-trip) and only the distance unit is
    // dirty — height is re-expressed in the baseline too, so it stays clean.
    fireEvent.click(screen.getByRole("button", { name: "Kilometers" }));
    expect(screen.getByLabelText("Height (cm)")).toHaveValue(180.1);
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    // Flip back: height returns to inches and the dirty count drops to 0 (no
    // spurious height dirty from round-tripping the conversion).
    fireEvent.click(screen.getByRole("button", { name: "Miles" }));
    expect(screen.getByLabelText("Height (in)")).toHaveValue(70.9);
    expect(saveBar()).not.toBeInTheDocument();
  });
});

// --- Avatar (immediate / out of draft) -------------------------------------
//
// AvatarRow owns the pick → crop → upload flow and is tested in
// _components/AvatarRow.test.tsx; these cover the page's wiring to it.

describe("Settings — avatar", () => {
  it("renders an initials placeholder when no avatar is set", () => {
    render(<SettingsPage />);
    expect(screen.getByText("SA")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
  });

  it("renders the avatar image and a Remove button when set", () => {
    useProfileMock.mockReturnValue(profileCtx({ avatar_url: "https://signed.example/a.png" }));
    render(<SettingsPage />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://signed.example/a.png");
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
  });

  it("opens the crop step rather than uploading the picked file, and stays out of the save bar", async () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText("Upload avatar");
    const png = new File(["x"], "a.png", { type: "image/png" });
    fireEvent.change(fileInput, { target: { files: [png] } });
    await screen.findByRole("dialog", { name: "Crop your avatar" });
    expect(uploadAvatarMock).not.toHaveBeenCalled();
    expect(saveBar()).not.toBeInTheDocument();
  });

  it("removes the avatar via removeAvatar()", async () => {
    useProfileMock.mockReturnValue(profileCtx({ avatar_url: "https://signed.example/a.png" }));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(removeAvatarMock).toHaveBeenCalled());
  });

  it("rejects a non-image file before the crop step", async () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText("Upload avatar");
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(fileInput, { target: { files: [pdf] } });
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("Use PNG, JPG, or WebP."));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(uploadAvatarMock).not.toHaveBeenCalled();
  });
});

// --- Units (draftable) ------------------------------------------------------

describe("Settings — units", () => {
  it("makes the weight toggle draftable rather than saving immediately", () => {
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Kilograms" }));
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("saves the weight unit in the patch on Save", async () => {
    updateMock.mockResolvedValueOnce(profile({ weight_unit: "kg" }));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Kilograms" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ weight_unit: "kg" }));
  });

  it("writes the distance unit through setUnit after a successful save", async () => {
    updateMock.mockResolvedValueOnce(profile({ distance_unit: "km" }));
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "Kilometers" }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(updateMock).toHaveBeenCalledWith({ distance_unit: "km" }));
    await waitFor(() => expect(setUnitMock).toHaveBeenCalledWith("km"));
  });
});

// --- Google Calendar --------------------------------------------------------

describe("Settings — Google Calendar", () => {
  // The calendar card now lives on the Integrations tab.
  beforeEach(() => {
    searchTab.value = "integrations";
  });

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
    expect(
      await screen.findByRole("button", { name: "Connect Google Calendar" }),
    ).toBeInTheDocument();
  });

  it("makes the default-detail toggle draftable rather than saving immediately", async () => {
    render(<SettingsPage />);
    const fullAgenda = await screen.findByRole("button", { name: "Full agenda" });
    fireEvent.click(fullAgenda);
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("saves the default-detail change in the patch on Save", async () => {
    updateMock.mockResolvedValueOnce(profile({ calendar_default_detail: "full_agenda" }));
    render(<SettingsPage />);
    const fullAgenda = await screen.findByRole("button", { name: "Full agenda" });
    fireEvent.click(fullAgenda);
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(updateMock).toHaveBeenCalledWith({ calendar_default_detail: "full_agenda" }),
    );
  });
});

// --- Tabs (URL-addressable via ?tab=) --------------------------------------

describe("Settings — tabs", () => {
  it("defaults to the Profile panel with no ?tab", () => {
    searchTab.value = null;
    render(<SettingsPage />);
    // Profile-only field is present; an Integrations-only card is not.
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Whoop" })).not.toBeInTheDocument();
    // Both tabs are exposed; Profile is selected.
    expect(screen.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Integrations" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("shows the Integrations panel when ?tab=integrations", async () => {
    searchTab.value = "integrations";
    render(<SettingsPage />);
    // Integrations cards render; the Profile field does not.
    expect(await screen.findByRole("heading", { name: "Whoop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Google Calendar" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Display name")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Integrations" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("selecting a tab replaces the URL with the ?tab= param", () => {
    searchTab.value = null;
    render(<SettingsPage />);
    fireEvent.click(screen.getByRole("tab", { name: "Integrations" }));
    expect(routerReplaceMock).toHaveBeenCalledWith("/settings?tab=integrations");
    fireEvent.click(screen.getByRole("tab", { name: "Profile" }));
    // Already on profile (no re-render of searchTab in test), but clicking a
    // non-active tab issues the replace; the profile tab maps to "/settings".
  });
});

// --- Whoop -----------------------------------------------------------------

describe("Settings — Whoop", () => {
  beforeEach(() => {
    searchTab.value = "integrations";
  });

  it("shows Connect Whoop when the connection is absent", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "absent" });
    render(<SettingsPage />);
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Disconnect Whoop" })).not.toBeInTheDocument();
  });

  it("shows Disconnect with a connected-since line when connected", async () => {
    getWhoopConnectionMock.mockResolvedValue({
      status: "connected",
      connected_at: "2026-05-01T00:00:00Z",
    });
    render(<SettingsPage />);
    expect(await screen.findByText(/Connected since/)).toBeInTheDocument();
    // The Whoop card's Disconnect (there is also the calendar's, so scope by card).
    const whoopCard = screen.getByRole("heading", { name: "Whoop" }).closest("section");
    expect(whoopCard).not.toBeNull();
    expect(
      await within(whoopCard as HTMLElement).findByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  it("shows Reconnect when the status is error", async () => {
    getWhoopConnectionMock.mockResolvedValue({ status: "error" });
    render(<SettingsPage />);
    expect(await screen.findByRole("button", { name: "Reconnect" })).toBeInTheDocument();
    expect(screen.getByText(/needs attention/)).toBeInTheDocument();
  });

  it("disconnects via disconnectWhoop() then re-fetches", async () => {
    getWhoopConnectionMock.mockResolvedValueOnce({ status: "connected" });
    getWhoopConnectionMock.mockResolvedValueOnce({ status: "absent" });
    render(<SettingsPage />);
    const whoopCard = screen.getByRole("heading", { name: "Whoop" }).closest("section");
    const btn = await within(whoopCard as HTMLElement).findByRole("button", { name: "Disconnect" });
    fireEvent.click(btn);
    await waitFor(() => expect(disconnectWhoopMock).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "Connect Whoop" })).toBeInTheDocument();
  });
});
