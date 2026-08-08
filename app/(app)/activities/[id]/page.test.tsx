/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import type { Activity } from "@/lib/api";

const routerMock = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => routerMock,
  useParams: () => ({ id: "act-1" }),
}));

const authMock = vi.hoisted(() => ({
  getToken: vi.fn(() => "test-token" as string | null),
  clearToken: vi.fn(),
  setPostLoginPath: vi.fn(),
}));
vi.mock("@/lib/auth", () => authMock);

const getActivityMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getActivity: getActivityMock,
}));

import ActivityPermalinkPage from "./page";

function activity(overrides: Partial<Activity>): Activity {
  return { id: "act-1", activity_type: "running", ...overrides } as Activity;
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.getToken.mockReturnValue("test-token");
});

describe("activity permalink", () => {
  // The table that matters: every type reaches a working destination. This is
  // the contract every Google Calendar event's footer link depends on.
  it.each([
    ["running", "/running/act-1"],
    ["hiking", "/hiking/act-1"],
    ["strength_training", "/workouts/act-1"],
    // walking / cycling / other have no detail surface of their own; the run
    // detail page has rendered them since before they had a home, which is
    // what activityDetailHref already encodes.
    ["walking", "/running/act-1"],
    ["cycling", "/running/act-1"],
    ["other", "/running/act-1"],
  ])("forwards a %s activity to %s", async (type, expected) => {
    getActivityMock.mockResolvedValue(
      activity({ activity_type: type as Activity["activity_type"] }),
    );

    render(<ActivityPermalinkPage />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith(expected));
  });

  it("shows a holding message while resolving", () => {
    getActivityMock.mockReturnValue(new Promise(() => {}));

    render(<ActivityPermalinkPage />);

    expect(screen.getByText(/opening activity/i)).toBeInTheDocument();
  });

  // A calendar event outlives the activity it points at, so a deleted session
  // must explain itself rather than erroring.
  it("explains a deleted activity", async () => {
    getActivityMock.mockRejectedValue(new Error("activity not found"));

    render(<ActivityPermalinkPage />);

    expect(await screen.findByText(/activity not found/i)).toBeInTheDocument();
    expect(screen.getByText(/may have been deleted/i)).toBeInTheDocument();
  });

  // Someone arriving from a calendar event is usually logged out; the
  // destination has to survive the OAuth round trip.
  it("remembers the destination when signed out", async () => {
    authMock.getToken.mockReturnValue(null);

    render(<ActivityPermalinkPage />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
    expect(authMock.setPostLoginPath).toHaveBeenCalledWith("/activities/act-1");
  });

  it("remembers the destination when the token is rejected", async () => {
    getActivityMock.mockRejectedValue(new Error("401 unauthorized"));

    render(<ActivityPermalinkPage />);

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith("/login"));
    expect(authMock.clearToken).toHaveBeenCalled();
    expect(authMock.setPostLoginPath).toHaveBeenCalledWith("/activities/act-1");
  });

  it("surfaces an unexpected failure", async () => {
    getActivityMock.mockRejectedValue(new Error("network is down"));

    render(<ActivityPermalinkPage />);

    expect(await screen.findByText(/network is down/i)).toBeInTheDocument();
  });
});
