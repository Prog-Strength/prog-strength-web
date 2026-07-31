/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { TimelineComment, TimelinePostWithComments } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const getPostMock = vi.hoisted(() => vi.fn());
const addCommentMock = vi.hoisted(() => vi.fn());
const deleteCommentMock = vi.hoisted(() => vi.fn());
const useProfileMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getTimelinePost: getPostMock,
  addTimelineComment: addCommentMock,
  deleteTimelineComment: deleteCommentMock,
}));

vi.mock("@/lib/profile-context", () => ({
  useProfile: useProfileMock,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorToastMock, info: vi.fn(), dismiss: vi.fn() }),
}));

import { CommentThread } from "./CommentThread";

const VIEWER_ID = "u_me";

function comment(id: string, userId: string, body: string): TimelineComment {
  return {
    id,
    post_id: "p1",
    user_id: userId,
    author: {
      user_id: userId,
      username: `user_${userId}`,
      display_name: `User ${userId}`,
      avatar_url: null,
    },
    body,
    created_at: "2026-06-10T12:00:00Z",
  };
}

function postWith(comments: TimelineComment[]): TimelinePostWithComments {
  return {
    id: "p1",
    source_type: "activity",
    activity_type: "strength_training",
    source_id: "w1",
    occurred_at: "2026-06-10T12:00:00Z",
    visibility: "private",
    author: { user_id: "u_me", username: "sam", display_name: "Sam", avatar_url: null },
    content: { title: "t", subtitle: "", metrics: [], href: "/workouts/w1" },
    reactions: { summary: {}, mine: [] },
    comment_count: comments.length,
    comments,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProfileMock.mockReturnValue({ profile: { id: VIEWER_ID } });
});

describe("CommentThread", () => {
  it("submits a non-empty comment body and appends it", async () => {
    getPostMock.mockResolvedValue(postWith([]));
    addCommentMock.mockResolvedValue(comment("c1", VIEWER_ID, "Nice lift"));
    render(<CommentThread postId="p1" />);

    await screen.findByText(/no comments yet/i);

    const box = screen.getByLabelText("Add a comment");
    fireEvent.change(box, { target: { value: "Nice lift" } });
    fireEvent.click(screen.getByRole("button", { name: /comment/i }));

    await waitFor(() =>
      expect(addCommentMock).toHaveBeenCalledWith("test-token", "p1", "Nice lift"),
    );
    expect(await screen.findByText("Nice lift")).toBeInTheDocument();
  });

  it("blocks an empty / whitespace-only body", async () => {
    getPostMock.mockResolvedValue(postWith([]));
    render(<CommentThread postId="p1" />);
    await screen.findByText(/no comments yet/i);

    const submit = screen.getByRole("button", { name: /comment/i });
    // Empty: disabled.
    expect(submit).toBeDisabled();

    // Whitespace only: still disabled, and clicking does nothing.
    fireEvent.change(screen.getByLabelText("Add a comment"), { target: { value: "   " } });
    expect(submit).toBeDisabled();
    fireEvent.click(submit);
    expect(addCommentMock).not.toHaveBeenCalled();
  });

  it("shows the delete affordance only on the viewer's own comments", async () => {
    getPostMock.mockResolvedValue(
      postWith([comment("c1", VIEWER_ID, "mine"), comment("c2", "u_other", "theirs")]),
    );
    deleteCommentMock.mockResolvedValue(undefined);
    render(<CommentThread postId="p1" />);

    await screen.findByText("mine");
    expect(screen.getByText("theirs")).toBeInTheDocument();

    // Each row renders its commenter's identity (display name).
    expect(screen.getByText(`User ${VIEWER_ID}`)).toBeInTheDocument();
    expect(screen.getByText("User u_other")).toBeInTheDocument();

    // Exactly one delete button — the viewer's own comment.
    const deletes = screen.getAllByRole("button", { name: /delete comment/i });
    expect(deletes).toHaveLength(1);

    fireEvent.click(deletes[0]);
    await waitFor(() => expect(deleteCommentMock).toHaveBeenCalledWith("test-token", "p1", "c1"));
  });
});
