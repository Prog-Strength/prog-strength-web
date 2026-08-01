/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const toastErrorMock = vi.hoisted(() => vi.fn());
const renderCroppedAvatarMock = vi.hoisted(() => vi.fn());

vi.mock("@/components/toast", () => ({
  useToast: () => ({
    success: vi.fn(),
    error: toastErrorMock,
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));

// The canvas draw is the one part jsdom can't run; the geometry that feeds it
// is covered in lib/avatar-crop.test.ts.
vi.mock("@/lib/avatar-crop", async (orig) => ({
  ...(await orig<typeof import("@/lib/avatar-crop")>()),
  renderCroppedAvatar: renderCroppedAvatarMock,
}));

import { AvatarRow } from "./AvatarRow";

const croppedFile = new File(["cropped"], "avatar.jpg", { type: "image/jpeg" });

function setup(over: Partial<React.ComponentProps<typeof AvatarRow>> = {}) {
  const onUpload = vi.fn(async () => {});
  const onRemove = vi.fn(async () => {});
  render(
    <AvatarRow
      avatarUrl={null}
      displayName="Sam Ash"
      disabled={false}
      onUpload={onUpload}
      onRemove={onRemove}
      {...over}
    />,
  );
  return { onUpload, onRemove };
}

/** Picks a file and lets the crop modal's preview image finish "loading". */
function pick(file: File, natural = { width: 1200, height: 800 }) {
  fireEvent.change(screen.getByLabelText("Upload avatar"), { target: { files: [file] } });
  const img = screen.getByAltText("Avatar preview") as HTMLImageElement;
  Object.defineProperty(img, "naturalWidth", { value: natural.width, configurable: true });
  Object.defineProperty(img, "naturalHeight", { value: natural.height, configurable: true });
  fireEvent.load(img);
  return img;
}

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:avatar");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.clearAllMocks();
  renderCroppedAvatarMock.mockResolvedValue(croppedFile);
});

describe("AvatarRow — picking", () => {
  it("opens the crop step instead of uploading the picked file", async () => {
    const { onUpload } = setup();
    pick(new File(["x"], "a.png", { type: "image/png" }));
    expect(await screen.findByRole("dialog", { name: "Crop your avatar" })).toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("rejects a file over the 5 MB source limit", () => {
    const { onUpload } = setup();
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Upload avatar"), { target: { files: [big] } });
    expect(toastErrorMock).toHaveBeenCalledWith("Image must be under 5 MB.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("accepts a file that the old 2 MB cap would have rejected", async () => {
    setup();
    const mid = new File(["x"], "phone-photo.jpg", { type: "image/jpeg" });
    Object.defineProperty(mid, "size", { value: 4 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Upload avatar"), { target: { files: [mid] } });
    expect(toastErrorMock).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Crop your avatar" })).toBeInTheDocument();
  });

  it("rejects a non-image file", () => {
    setup();
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Upload avatar"), { target: { files: [pdf] } });
    expect(toastErrorMock).toHaveBeenCalledWith("Use PNG, JPG, or WebP.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("AvatarRow — cropping", () => {
  it("uploads the CROPPED image, not the picked file, and closes", async () => {
    const { onUpload } = setup();
    const source = new File(["x"], "a.png", { type: "image/png" });
    pick(source);

    fireEvent.click(await screen.findByRole("button", { name: "Save avatar" }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledWith(croppedFile));
    // The source went to the renderer as the source-of-truth for the output
    // encoding, and the selection came from the current transform.
    const [, rect, sourceType] = renderCroppedAvatarMock.mock.calls[0];
    expect(sourceType).toBe("image/png");
    // 1200x800 centered at zoom 1 ⇒ the middle 800px square.
    expect(rect).toEqual({ sx: 200, sy: 0, size: 800 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("crops what the user framed after zooming", async () => {
    setup();
    pick(new File(["x"], "a.png", { type: "image/png" }), { width: 1000, height: 1000 });

    fireEvent.change(screen.getByLabelText("Zoom"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save avatar" }));

    await waitFor(() => expect(renderCroppedAvatarMock).toHaveBeenCalled());
    const [, rect] = renderCroppedAvatarMock.mock.calls[0];
    expect(rect).toEqual({ sx: 250, sy: 250, size: 500 });
  });

  it("pans with the arrow keys, bounded by the image edge", async () => {
    setup();
    pick(new File(["x"], "a.png", { type: "image/png" }), { width: 1600, height: 800 });

    const area = screen.getByRole("application", { name: /Crop area/ });
    // Ten presses is past the half-viewport of overhang a 2:1 image has, so
    // the selection pins to the left edge rather than running off it.
    for (let i = 0; i < 10; i++) fireEvent.keyDown(area, { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "Save avatar" }));

    await waitFor(() => expect(renderCroppedAvatarMock).toHaveBeenCalled());
    const [, rect] = renderCroppedAvatarMock.mock.calls[0];
    // Ten float additions land a hair off the exact edge; closeTo, not toEqual.
    expect(rect.sx).toBeCloseTo(0, 6);
    expect(rect.sy).toBeCloseTo(0, 6);
    expect(rect.size).toBe(800);
  });

  it("discards the pick on cancel", async () => {
    const { onUpload } = setup();
    pick(new File(["x"], "a.png", { type: "image/png" }));

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onUpload).not.toHaveBeenCalled();
    expect(renderCroppedAvatarMock).not.toHaveBeenCalled();
  });

  it("keeps the crop open with an error when the upload fails", async () => {
    const { onUpload } = setup();
    onUpload.mockRejectedValueOnce(new Error("Network is down"));
    pick(new File(["x"], "a.png", { type: "image/png" }));

    fireEvent.click(await screen.findByRole("button", { name: "Save avatar" }));

    expect(await screen.findByText("Network is down")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Crop your avatar" })).toBeInTheDocument();
    // Re-savable: the framing survives the failure.
    expect(screen.getByRole("button", { name: "Save avatar" })).toBeEnabled();
  });
});

describe("AvatarRow — remove", () => {
  it("calls onRemove and toasts on failure", async () => {
    const { onRemove } = setup({ avatarUrl: "https://signed.example/a.png" });
    onRemove.mockRejectedValueOnce(new Error("nope"));
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith("nope"));
  });
});
