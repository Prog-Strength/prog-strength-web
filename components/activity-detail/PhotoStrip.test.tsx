/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ActivityPhoto } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const uploadActivityPhotoDirectMock = vi.hoisted(() => vi.fn());
const updateActivityPhotoCaptionMock = vi.hoisted(() => vi.fn());
const reorderActivityPhotosMock = vi.hoisted(() => vi.fn());
const deleteActivityPhotoMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  uploadActivityPhotoDirect: uploadActivityPhotoDirectMock,
  updateActivityPhotoCaption: updateActivityPhotoCaptionMock,
  reorderActivityPhotos: reorderActivityPhotosMock,
  deleteActivityPhoto: deleteActivityPhotoMock,
}));

vi.mock("@/components/toast", () => ({
  useToast: () => ({ success: vi.fn(), error: errorToastMock, info: vi.fn(), dismiss: vi.fn() }),
}));

import { PhotoStrip } from "./PhotoStrip";

beforeEach(() => {
  vi.clearAllMocks();
});

function photo(id: string, position: number, caption: string | null = null): ActivityPhoto {
  return {
    id,
    url: `https://cdn.example/${id}.jpg`,
    thumb_url: `https://cdn.example/${id}-thumb.jpg`,
    width: 800,
    height: 600,
    caption,
    position,
    status: "ready",
  };
}

/** A File with a controllable type and size — jsdom Files are always tiny, so size is defined explicitly. */
function makeFile(name: string, type = "image/jpeg", size = 1024): File {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function selectFiles(files: File[]) {
  fireEvent.change(screen.getByLabelText("Add photos"), { target: { files } });
}

const PHOTOS = [photo("p1", 0), photo("p2", 1), photo("p3", 2)];

function renderStrip(props: Partial<React.ComponentProps<typeof PhotoStrip>> = {}) {
  return render(
    <PhotoStrip
      photos={PHOTOS}
      activityId="a1"
      activityName="Upper 1"
      isOwner={true}
      onPhotosChanged={vi.fn()}
      {...props}
    />,
  );
}

describe("PhotoStrip", () => {
  it("renders one aspect-ratio thumbnail per photo", () => {
    renderStrip({ isOwner: false });
    const thumbs = screen.getAllByRole("img");
    expect(thumbs).toHaveLength(3);
    // Layout reserved via aspect-ratio on the thumbnail button.
    const buttons = screen.getAllByRole("button", { name: /view/i });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toHaveStyle({ aspectRatio: "800 / 600" });
  });

  it("owner sees Add and Edit affordances", () => {
    renderStrip({ isOwner: true });
    expect(screen.getByRole("button", { name: /add photo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Edit$/ })).toBeInTheDocument();
  });

  it("non-owner does NOT see Add or Edit affordances", () => {
    renderStrip({ isOwner: false });
    expect(screen.queryByRole("button", { name: /add photo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit$/ })).not.toBeInTheDocument();
  });

  it("renders nothing for a non-owner with no photos", () => {
    const { container } = render(
      <PhotoStrip
        photos={[]}
        activityId="a1"
        activityName="Upper 1"
        isOwner={false}
        onPhotosChanged={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("move-right issues ONE reorder call with the full id list in the new order", async () => {
    reorderActivityPhotosMock.mockResolvedValue(PHOTOS);
    const onPhotosChanged = vi.fn();
    renderStrip({ onPhotosChanged });

    // Enter edit mode to expose the move controls.
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));

    // Move the first photo (p1) one slot right → p2, p1, p3.
    const moveRights = screen.getAllByRole("button", { name: /move right/i });
    fireEvent.click(moveRights[0]);

    await waitFor(() => expect(reorderActivityPhotosMock).toHaveBeenCalledTimes(1));
    expect(reorderActivityPhotosMock).toHaveBeenCalledWith("test-token", "a1", ["p2", "p1", "p3"]);
    await waitFor(() => expect(onPhotosChanged).toHaveBeenCalled());
  });

  it("disables move-left on the first photo and move-right on the last", () => {
    renderStrip();
    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));

    const moveLefts = screen.getAllByRole("button", { name: /move left/i });
    const moveRights = screen.getAllByRole("button", { name: /move right/i });
    expect(moveLefts[0]).toBeDisabled();
    expect(moveRights[moveRights.length - 1]).toBeDisabled();
  });

  it("delete calls deleteActivityPhoto and refreshes", async () => {
    deleteActivityPhotoMock.mockResolvedValue(undefined);
    const onPhotosChanged = vi.fn();
    renderStrip({ onPhotosChanged });

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /delete photo/i })[0]);

    await waitFor(() =>
      expect(deleteActivityPhotoMock).toHaveBeenCalledWith("test-token", "a1", "p1"),
    );
    await waitFor(() => expect(onPhotosChanged).toHaveBeenCalled());
  });

  it("caption edit commits on blur via updateActivityPhotoCaption", async () => {
    updateActivityPhotoCaptionMock.mockResolvedValue(photo("p1", 0, "Big lift"));
    renderStrip();

    fireEvent.click(screen.getByRole("button", { name: /^Edit$/ }));
    const caption = screen.getAllByLabelText("Photo caption")[0];
    fireEvent.change(caption, { target: { value: "Big lift" } });
    fireEvent.blur(caption);

    await waitFor(() =>
      expect(updateActivityPhotoCaptionMock).toHaveBeenCalledWith(
        "test-token",
        "a1",
        "p1",
        "Big lift",
      ),
    );
  });
});

describe("PhotoStrip batch upload", () => {
  it("uploads a batch of three in selection order, refreshing after each commit", async () => {
    uploadActivityPhotoDirectMock.mockResolvedValue(photo("new", 0));
    const onPhotosChanged = vi.fn();
    renderStrip({ photos: [], onPhotosChanged });

    selectFiles([makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")]);

    await waitFor(() => expect(uploadActivityPhotoDirectMock).toHaveBeenCalledTimes(3));
    const uploadedNames = uploadActivityPhotoDirectMock.mock.calls.map(
      (call) => (call[2] as File).name,
    );
    expect(uploadedNames).toEqual(["a.jpg", "b.jpg", "c.jpg"]);
    // One refresh per successful commit — photos appear as they land.
    expect(onPhotosChanged).toHaveBeenCalledTimes(3);
    expect(errorToastMock).not.toHaveBeenCalled();
  });

  it("a mid-batch failure keeps earlier successes and still attempts later files", async () => {
    uploadActivityPhotoDirectMock
      .mockResolvedValueOnce(photo("n1", 0))
      .mockRejectedValueOnce(new Error("Upload failed before the server responded"))
      .mockResolvedValueOnce(photo("n2", 1));
    const onPhotosChanged = vi.fn();
    renderStrip({ photos: [], onPhotosChanged });

    selectFiles([makeFile("a.jpg"), makeFile("b.jpg"), makeFile("c.jpg")]);

    // The failure does not abort the loop: all three are attempted.
    await waitFor(() => expect(uploadActivityPhotoDirectMock).toHaveBeenCalledTimes(3));
    expect(onPhotosChanged).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(errorToastMock).toHaveBeenCalledWith("1 photo failed — 1 upload error."),
    );
  });

  it("an over-cap selection uploads nothing and names the remaining slots", async () => {
    // Strip already holds 3 photos; cap is 10 → 7 slots remain.
    renderStrip();

    selectFiles(Array.from({ length: 8 }, (_, i) => makeFile(`f${i}.jpg`)));

    await waitFor(() =>
      expect(errorToastMock).toHaveBeenCalledWith("You can add 7 more photos — you selected 8."),
    );
    expect(uploadActivityPhotoDirectMock).not.toHaveBeenCalled();
  });

  it("a full strip refuses any selection with the at-cap message", async () => {
    // Already at the cap of 10 — the toast names the cap instead of offering
    // "0 more" slots.
    renderStrip({ photos: Array.from({ length: 10 }, (_, i) => photo(`p${i}`, i)) });

    selectFiles([makeFile("a.jpg")]);

    await waitFor(() =>
      expect(errorToastMock).toHaveBeenCalledWith(
        "This activity already has the maximum of 10 photos.",
      ),
    );
    expect(uploadActivityPhotoDirectMock).not.toHaveBeenCalled();
  });

  it("reports the correct index/total as the batch advances", async () => {
    let resolveUpload!: (value: unknown) => void;
    uploadActivityPhotoDirectMock.mockImplementation(
      (_token, _activityId, _file, opts: { onProgress: (fraction: number) => void }) =>
        new Promise((resolve) => {
          resolveUpload = resolve;
          opts.onProgress(0.62);
        }),
    );
    renderStrip({ photos: [] });

    selectFiles([makeFile("a.jpg"), makeFile("b.jpg")]);

    // Mid-batch the Add button doubles as the progress readout and is
    // disabled — a second selection during a batch would scramble the count.
    const uploading = await screen.findByRole("button", { name: "Uploading 1 of 2 — 62%" });
    expect(uploading).toBeDisabled();
    resolveUpload(photo("n1", 0));
    await screen.findByRole("button", { name: "Uploading 2 of 2 — 62%" });
    resolveUpload(photo("n2", 1));
    // Batch done: the button reverts to its label and is clickable again.
    expect(await screen.findByRole("button", { name: "+ Add photos" })).toBeEnabled();
  });

  it("skips a file rejected on type without aborting the batch", async () => {
    uploadActivityPhotoDirectMock.mockResolvedValue(photo("new", 0));
    renderStrip({ photos: [] });

    selectFiles([makeFile("bad.heic", "image/heic"), makeFile("good.jpg")]);

    await waitFor(() => expect(uploadActivityPhotoDirectMock).toHaveBeenCalledTimes(1));
    expect((uploadActivityPhotoDirectMock.mock.calls[0][2] as File).name).toBe("good.jpg");
    await waitFor(() =>
      expect(errorToastMock).toHaveBeenCalledWith("1 photo failed — 1 unsupported format."),
    );
  });

  it("groups mixed failures into one toast", async () => {
    uploadActivityPhotoDirectMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockRejectedValueOnce(new Error("server sad"));
    renderStrip({ photos: [] });

    selectFiles([
      makeFile("bad.heic", "image/heic"),
      makeFile("huge.jpg", "image/jpeg", 13 * 1024 * 1024),
      makeFile("a.jpg"),
      makeFile("b.jpg"),
    ]);

    await waitFor(() => expect(uploadActivityPhotoDirectMock).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(errorToastMock).toHaveBeenCalledWith(
        "4 photos failed — 1 unsupported format, 1 file over 12 MB, 2 upload errors.",
      ),
    );
    expect(errorToastMock).toHaveBeenCalledTimes(1);
  });
});
