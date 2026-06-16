/// <reference types="vitest/globals" />

import { render, screen, waitFor } from "@testing-library/react";
import type { PublicProfile } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const getProfileMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useParams: () => ({ username: "sam" }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getProfile: getProfileMock,
}));

// The activity feed and stats sections make their own API calls; stub them so
// the header tests stay isolated to the profile payload.
vi.mock("./_components/ProfileActivityFeed", () => ({
  ProfileActivityFeed: () => null,
}));

vi.mock("./_components/ProfileStats", () => ({
  ProfileStats: () => null,
}));

import ProfilePage from "./page";

// --- helpers ---------------------------------------------------------------

function publicProfile(over: Partial<PublicProfile> = {}): PublicProfile {
  return {
    user_id: "u1",
    username: "sam",
    display_name: "Sam",
    avatar_url: null,
    // "self" renders the Edit-profile link rather than a <FollowButton>, so the
    // header tests don't need a ToastProvider in the tree.
    relationship: "self",
    follower_count: 3,
    following_count: 5,
    bio: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Profile header — bio", () => {
  it("renders the bio text when profile.bio is set", async () => {
    getProfileMock.mockResolvedValue(publicProfile({ bio: "Lifts heavy things." }));
    render(<ProfilePage />);
    expect(await screen.findByText("Lifts heavy things.")).toBeInTheDocument();
  });

  it("renders no bio element when profile.bio is null", async () => {
    getProfileMock.mockResolvedValue(publicProfile({ bio: null }));
    render(<ProfilePage />);
    // Wait for the header to render (handle proves the profile loaded), then
    // assert no stray bio paragraph appears.
    await waitFor(() => expect(screen.getByText("@sam")).toBeInTheDocument());
    expect(screen.queryByText("Lifts heavy things.")).not.toBeInTheDocument();
  });
});
