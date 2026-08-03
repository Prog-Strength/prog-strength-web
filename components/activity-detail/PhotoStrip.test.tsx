/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ActivityPhoto } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const uploadActivityPhotoMock = vi.hoisted(() => vi.fn());
const updateActivityPhotoCaptionMock = vi.hoisted(() => vi.fn());
const reorderActivityPhotosMock = vi.hoisted(() => vi.fn());
const deleteActivityPhotoMock = vi.hoisted(() => vi.fn());
const errorToastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  uploadActivityPhoto: uploadActivityPhotoMock,
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
