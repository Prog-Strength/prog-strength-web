/**
 * Avatar crop geometry + rendering.
 *
 * The crop UI is a square viewport with the source image behind it: zoom
 * scales the image, dragging pans it, and whatever shows through the viewport
 * becomes the avatar. This module owns the math for that and the canvas draw
 * that turns it into an uploadable file, so the modal stays presentational.
 *
 * Everything here is expressed in **viewport units** rather than pixels: one
 * unit is one edge of the square viewport. At zoom 1 the image's shorter edge
 * is exactly one unit (a cover fit), so the viewport is always fully covered
 * and the geometry doesn't change when the box is rendered at a different CSS
 * size. Only the pointer-drag handler converts pixels into units, and it does
 * so with the box's measured width at the time of the drag.
 */

/** Edge of the square the avatar is written out at. */
export const AVATAR_OUTPUT_PX = 512;

/** JPEG quality for re-encoded output. High enough that a 512px face holds up. */
export const AVATAR_JPEG_QUALITY = 0.92;

export const AVATAR_MIN_ZOOM = 1;
export const AVATAR_MAX_ZOOM = 4;

/** Intrinsic (EXIF-oriented) size of the source image, in pixels. */
export type NaturalSize = { width: number; height: number };

/**
 * The user's crop. `zoom` is relative to the cover fit; `offsetX`/`offsetY`
 * translate the image center away from the viewport center, in viewport units
 * (positive x pans the image right, revealing its left side).
 */
export type CropTransform = { zoom: number; offsetX: number; offsetY: number };

/** A square selection in source-image pixels. */
export type CropRect = { sx: number; sy: number; size: number };

export const INITIAL_TRANSFORM: CropTransform = { zoom: 1, offsetX: 0, offsetY: 0 };

/** The displayed image size in viewport units at the given zoom. */
export function displayedSize(
  natural: NaturalSize,
  zoom: number,
): { width: number; height: number } {
  const shorter = Math.min(natural.width, natural.height);
  return {
    width: (natural.width / shorter) * zoom,
    height: (natural.height / shorter) * zoom,
  };
}

/**
 * Clamps a transform so the zoom stays in range and the image never uncovers
 * the viewport: each offset can move at most half the overhang on that axis.
 */
export function clampTransform(t: CropTransform, natural: NaturalSize): CropTransform {
  const zoom = clamp(t.zoom, AVATAR_MIN_ZOOM, AVATAR_MAX_ZOOM);
  const size = displayedSize(natural, zoom);
  const maxX = Math.max(0, (size.width - 1) / 2);
  const maxY = Math.max(0, (size.height - 1) / 2);
  return {
    zoom,
    offsetX: clamp(t.offsetX, -maxX, maxX),
    offsetY: clamp(t.offsetY, -maxY, maxY),
  };
}

/**
 * Maps a (clamped) transform to the square of source pixels the viewport is
 * showing. Pass an unclamped transform and the rect can fall outside the
 * image — callers clamp on every state change instead.
 */
export function cropRectFor(t: CropTransform, natural: NaturalSize): CropRect {
  // One viewport unit covers this many source pixels.
  const unitPx = Math.min(natural.width, natural.height) / t.zoom;
  const size = unitPx;
  const centerX = natural.width / 2 - t.offsetX * unitPx;
  const centerY = natural.height / 2 - t.offsetY * unitPx;
  // A fully panned offset lands a hair outside the image on float rounding;
  // pin the rect to the source bounds so drawImage never samples off-image.
  return {
    sx: clamp(centerX - size / 2, 0, natural.width - size),
    sy: clamp(centerY - size / 2, 0, natural.height - size),
    size,
  };
}

/**
 * The output square's edge: the standard size, or the selection itself when
 * it's smaller — upscaling a small source only costs bytes.
 */
export function outputSizeFor(selectionPx: number): number {
  return Math.min(AVATAR_OUTPUT_PX, Math.round(selectionPx));
}

/**
 * PNG survives as PNG so a transparent avatar keeps its transparency (it
 * renders on the sidebar's surface, not on white); everything else — JPEG,
 * WebP — is re-encoded as JPEG, which the API allowlist accepts everywhere.
 */
export function outputTypeFor(sourceType: string): "image/png" | "image/jpeg" {
  return sourceType === "image/png" ? "image/png" : "image/jpeg";
}

/** File name for the cropped upload, keyed to the OUTPUT type. */
export function croppedFileName(outputType: string): string {
  return outputType === "image/png" ? "avatar.png" : "avatar.jpg";
}

/**
 * Draws the selection into a square canvas and returns it as an upload-ready
 * File. Rejects when the browser can't produce a blob (no 2D context, a
 * tainted canvas) so the caller can surface a toast and keep the modal open.
 */
export async function renderCroppedAvatar(
  image: CanvasImageSource,
  rect: CropRect,
  sourceType: string,
): Promise<File> {
  const outputType = outputTypeFor(sourceType);
  const edge = outputSizeFor(rect.size);
  const canvas = document.createElement("canvas");
  canvas.width = edge;
  canvas.height = edge;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this image.");
  // JPEG has no alpha: without a fill, a transparent source would composite
  // onto black. (PNG output keeps the transparency and skips this.)
  if (outputType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, edge, edge);
  }
  ctx.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, edge, edge);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), outputType, AVATAR_JPEG_QUALITY);
  });
  if (!blob) throw new Error("Your browser couldn't process this image.");
  return new File([blob], croppedFileName(outputType), { type: outputType });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
