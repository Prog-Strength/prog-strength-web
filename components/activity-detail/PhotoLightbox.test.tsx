/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import type { ActivityPhoto } from "@/lib/api";
import { PhotoLightbox } from "./PhotoLightbox";

function photo(id: string, caption: string | null = null): ActivityPhoto {
  return {
    id,
    url: `https://cdn.example/${id}.jpg`,
    thumb_url: `https://cdn.example/${id}-thumb.jpg`,
    width: 800,
    height: 600,
    caption,
    position: 0,
  };
}

const PHOTOS = [photo("p1", "First shot"), photo("p2", "Second shot"), photo("p3")];

function renderLightbox(index: number, onIndexChange = vi.fn(), onClose = vi.fn()) {
  render(
    <PhotoLightbox
      photos={PHOTOS}
      index={index}
      activityName="Upper 1"
      onIndexChange={onIndexChange}
      onClose={onClose}
    />,
  );
  return { onIndexChange, onClose };
}

describe("PhotoLightbox", () => {
  it("renders the full image and its caption", () => {
    renderLightbox(0);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://cdn.example/p1.jpg");
    expect(screen.getByText("First shot")).toBeInTheDocument();
    // alt uses the caption.
    expect(img).toHaveAttribute("alt", "First shot");
  });

  it("falls back to a generated alt when there is no caption", () => {
    renderLightbox(2);
    expect(screen.getByRole("img")).toHaveAttribute("alt", "Photo from Upper 1");
  });

  it("navigates with ArrowRight / ArrowLeft", () => {
    const { onIndexChange } = renderLightbox(1);

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(onIndexChange).toHaveBeenCalledWith(2);

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("clamps navigation at the ends", () => {
    const { onIndexChange } = renderLightbox(0);
    // Already at the first — ArrowLeft is a no-op.
    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(onIndexChange).not.toHaveBeenCalled();
  });

  it("previous/next buttons navigate", () => {
    const { onIndexChange } = renderLightbox(1);
    fireEvent.click(screen.getByRole("button", { name: /next photo/i }));
    expect(onIndexChange).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole("button", { name: /previous photo/i }));
    expect(onIndexChange).toHaveBeenCalledWith(0);
  });

  it("hides Previous on the first and Next on the last", () => {
    const { rerender } = render(
      <PhotoLightbox
        photos={PHOTOS}
        index={0}
        activityName="Upper 1"
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /previous photo/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next photo/i })).toBeInTheDocument();

    rerender(
      <PhotoLightbox
        photos={PHOTOS}
        index={2}
        activityName="Upper 1"
        onIndexChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /previous photo/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next photo/i })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const { onClose } = renderLightbox(0);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on the Close button", () => {
    const { onClose } = renderLightbox(0);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("is a focus-trapped dialog", () => {
    renderLightbox(0);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // The dialog shell holds focus on open.
    expect(dialog).toHaveFocus();
  });
});
