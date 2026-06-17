/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const searchMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/lib/api", () => ({ searchProfiles: searchMock }));
vi.mock("@/components/social/ProfileRow", () => ({
  ProfileRow: ({ user }: { user: { display_name: string } }) => <div>{user.display_name}</div>,
}));

import { DiscoveryRail } from "./DiscoveryRail";

beforeEach(() => {
  vi.clearAllMocks();
  searchMock.mockResolvedValue({
    users: [
      {
        user_id: "u1",
        username: "ana",
        display_name: "Ana Runner",
        avatar_url: null,
        relationship: "none",
      },
    ],
    next_cursor: null,
  });
});

describe("DiscoveryRail", () => {
  it("renders a find-people prompt and search input", () => {
    render(<DiscoveryRail />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("searches and lists matching profiles", async () => {
    render(<DiscoveryRail />);
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: "ana" } });
    fireEvent.submit(screen.getByRole("search"));
    await waitFor(() => expect(searchMock).toHaveBeenCalledWith("test-token", "ana"));
    expect(await screen.findByText("Ana Runner")).toBeInTheDocument();
  });
});
