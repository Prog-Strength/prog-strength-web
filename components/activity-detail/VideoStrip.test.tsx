/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ActivityVideo } from "@/lib/api";

vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));

const toastError = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));

// The three upload steps are mocked individually so the test can assert the
// ORDER and the handoff between them — that ordering is the whole design (the
// bytes go around the API, not through it).
const reserveMock = vi.hoisted(() => vi.fn());
const uploadMock = vi.hoisted(() => vi.fn());
const completeMock = vi.hoisted(() => vi.fn());
const deleteMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  reserveActivityVideo: reserveMock,
  uploadVideoToStorage: uploadMock,
  completeActivityVideo: completeMock,
  deleteActivityVideo: deleteMock,
  updateActivityVideoCaption: vi.fn(),
  reorderActivityVideos: vi.fn(),
}));

// jsdom can't decode video; probeVideo is stubbed per-test.
const probeMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/video-poster", async (orig) => ({
  ...(await orig<typeof import("@/lib/video-poster")>()),
  probeVideo: probeMock,
}));

import { VideoStrip } from "./VideoStrip";

function video(overrides: Partial<ActivityVideo> = {}): ActivityVideo {
  return {
    id: "vid_1",
    url: "https://example.test/v.mp4",
    poster_url: "https://example.test/p.jpg",
    content_type: "video/mp4",
    byte_size: 5000,
    duration_seconds: 75,
    width: 1920,
    height: 1080,
    caption: null,
    position: 0,
    ...overrides,
  };
}

function mp4(name = "clip.mp4", size = 1000): File {
  return new File([new Uint8Array(size)], name, { type: "video/mp4" });
}

beforeEach(() => {
  vi.clearAllMocks();
  probeMock.mockResolvedValue({
    durationSeconds: 12,
    width: 1920,
    height: 1080,
    poster: new Blob(["x"], { type: "image/jpeg" }),
  });
});

describe("VideoStrip", () => {
  it("renders a thumbnail per video with its duration badge", () => {
    render(
      <VideoStrip
        videos={[video(), video({ id: "vid_2", duration_seconds: 5 })]}
        activityId="act_1"
        activityName="Franconia Ridge"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    // Both fall back to the activity name for their label (neither is captioned).
    expect(screen.getAllByRole("button", { name: /Play Video from Franconia Ridge/ })).toHaveLength(
      2,
    );
    expect(screen.getByText("1:15")).toBeInTheDocument();
    expect(screen.getByText("0:05")).toBeInTheDocument();
  });

  // A null poster is an expected state, not an error: the browser couldn't
  // decode a frame but the video is still stored and playable.
  it("shows a placeholder instead of a broken image when the poster is null", () => {
    render(
      <VideoStrip
        videos={[video({ poster_url: null })]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("No preview")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders nothing for a non-owner with no videos", () => {
    const { container } = render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner={false}
        onVideosChanged={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("offers the Add affordance to the owner with no videos yet", () => {
    render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    expect(screen.getByText("+ Add video")).toBeInTheDocument();
    expect(screen.getByText("No videos on this session yet.")).toBeInTheDocument();
  });

  it("hides owner controls from a non-owner who can still watch", () => {
    render(
      <VideoStrip
        videos={[video()]}
        activityId="act_1"
        activityName="Hike"
        isOwner={false}
        onVideosChanged={vi.fn()}
      />,
    );
    expect(screen.queryByText("+ Add video")).not.toBeInTheDocument();
    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Play/ })).toBeTruthy();
  });

  // The three-step handshake: reserve → PUT to the presigned URL → complete.
  // The upload must go to the URL the reservation returned, and the completion
  // must carry the reservation's id and the probed poster.
  it("runs reserve → direct upload → complete in order", async () => {
    reserveMock.mockResolvedValue({
      video_id: "vid_new",
      upload_url: "https://s3.example.test/put-here",
      expires_at: "2026-08-01T00:00:00Z",
    });
    uploadMock.mockResolvedValue(undefined);
    completeMock.mockResolvedValue(video({ id: "vid_new" }));
    const onChanged = vi.fn();

    render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={onChanged}
      />,
    );

    fireEvent.change(screen.getByLabelText("Add video"), { target: { files: [mp4()] } });

    await waitFor(() => expect(completeMock).toHaveBeenCalled());

    expect(reserveMock).toHaveBeenCalledWith(
      "test-token",
      "act_1",
      expect.objectContaining({ content_type: "video/mp4", duration_seconds: 12 }),
    );
    // Step 2 targets the presigned URL from step 1 — not the API.
    expect(uploadMock.mock.calls[0][0]).toBe("https://s3.example.test/put-here");
    // Step 3 carries the reserved id and the probed poster blob.
    expect(completeMock.mock.calls[0][1]).toBe("act_1");
    expect(completeMock.mock.calls[0][2]).toBe("vid_new");
    expect(completeMock.mock.calls[0][3]).toBeInstanceOf(Blob);
    expect(onChanged).toHaveBeenCalled();
  });

  // Losing the poster must not lose the video — the upload still completes and
  // the user is told, rather than the file being rejected.
  it("still completes the upload when no poster could be captured", async () => {
    probeMock.mockResolvedValue({
      durationSeconds: null,
      width: null,
      height: null,
      poster: null,
    });
    reserveMock.mockResolvedValue({
      video_id: "vid_new",
      upload_url: "https://s3.example.test/put-here",
      expires_at: "2026-08-01T00:00:00Z",
    });
    uploadMock.mockResolvedValue(undefined);
    completeMock.mockResolvedValue(video({ id: "vid_new", poster_url: null }));

    render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Add video"), { target: { files: [mp4()] } });

    await waitFor(() => expect(completeMock).toHaveBeenCalled());
    expect(completeMock.mock.calls[0][3]).toBeNull();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("preview frame"));
  });

  it("rejects an unsupported container before reserving anything", async () => {
    render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    const mkv = new File([new Uint8Array(10)], "clip.mkv", { type: "video/x-matroska" });
    fireEvent.change(screen.getByLabelText("Add video"), { target: { files: [mkv] } });

    expect(reserveMock).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith(expect.stringContaining("MP4"));
  });

  it("surfaces an upload failure as a toast without calling complete", async () => {
    reserveMock.mockResolvedValue({
      video_id: "vid_new",
      upload_url: "https://s3.example.test/put-here",
      expires_at: "2026-08-01T00:00:00Z",
    });
    uploadMock.mockRejectedValue(new Error("Upload failed (HTTP 403)"));

    render(
      <VideoStrip
        videos={[]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Add video"), { target: { files: [mp4()] } });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Upload failed (HTTP 403)"));
    expect(completeMock).not.toHaveBeenCalled();
  });

  it("opens a player with the video source when a thumbnail is clicked", async () => {
    render(
      <VideoStrip
        videos={[video({ caption: "Summit push" })]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Play Summit push/ }));

    const dialog = screen.getByRole("dialog", { name: "Video player" });
    expect(dialog).toBeInTheDocument();
    expect(dialog.querySelector("video")).toHaveAttribute("src", "https://example.test/v.mp4");
    // preload=metadata matters: the source is the untranscoded original.
    expect(dialog.querySelector("video")).toHaveAttribute("preload", "metadata");
  });

  it("deletes a video through the edit controls", async () => {
    deleteMock.mockResolvedValue(undefined);
    const onChanged = vi.fn();
    render(
      <VideoStrip
        videos={[video()]}
        activityId="act_1"
        activityName="Hike"
        isOwner
        onVideosChanged={onChanged}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByLabelText("Delete video"));

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("test-token", "act_1", "vid_1"));
    expect(onChanged).toHaveBeenCalled();
  });
});
