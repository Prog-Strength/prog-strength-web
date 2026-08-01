import { describe, expect, it } from "vitest";
import {
  AVATAR_MAX_ZOOM,
  AVATAR_MIN_ZOOM,
  AVATAR_OUTPUT_PX,
  clampTransform,
  croppedFileName,
  cropRectFor,
  displayedSize,
  INITIAL_TRANSFORM,
  outputSizeFor,
  outputTypeFor,
} from "./avatar-crop";

const landscape = { width: 4000, height: 2000 };
const portrait = { width: 1000, height: 2000 };
const square = { width: 900, height: 900 };

describe("displayedSize", () => {
  it("fits the shorter edge to exactly one viewport at zoom 1", () => {
    expect(displayedSize(landscape, 1)).toEqual({ width: 2, height: 1 });
    expect(displayedSize(portrait, 1)).toEqual({ width: 1, height: 2 });
    expect(displayedSize(square, 1)).toEqual({ width: 1, height: 1 });
  });

  it("scales both edges by the zoom factor", () => {
    expect(displayedSize(landscape, 2)).toEqual({ width: 4, height: 2 });
  });
});

describe("clampTransform", () => {
  it("keeps the viewport fully covered by pinning offsets to the overhang", () => {
    // A 2x1 displayed image can slide half a viewport either way horizontally
    // and not at all vertically.
    const clamped = clampTransform({ zoom: 1, offsetX: 5, offsetY: 5 }, landscape);
    expect(clamped).toEqual({ zoom: 1, offsetX: 0.5, offsetY: 0 });
  });

  it("leaves an in-range offset untouched", () => {
    const t = { zoom: 1, offsetX: 0.25, offsetY: 0 };
    expect(clampTransform(t, landscape)).toEqual(t);
  });

  it("clamps the zoom into range", () => {
    expect(clampTransform({ ...INITIAL_TRANSFORM, zoom: 99 }, square).zoom).toBe(AVATAR_MAX_ZOOM);
    expect(clampTransform({ ...INITIAL_TRANSFORM, zoom: 0.1 }, square).zoom).toBe(AVATAR_MIN_ZOOM);
  });

  it("re-clamps an offset that a zoom-out just made illegal", () => {
    // Panned to the edge at 2x, then zoomed back to 1x: the offset has to
    // shrink with the overhang or a gap would open at the viewport edge.
    const panned = clampTransform({ zoom: 2, offsetX: 99, offsetY: 99 }, square);
    expect(panned).toEqual({ zoom: 2, offsetX: 0.5, offsetY: 0.5 });
    expect(clampTransform({ ...panned, zoom: 1 }, square)).toEqual({
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe("cropRectFor", () => {
  it("selects the centered square of a landscape source at zoom 1", () => {
    expect(cropRectFor(INITIAL_TRANSFORM, landscape)).toEqual({ sx: 1000, sy: 0, size: 2000 });
  });

  it("selects the centered square of a portrait source at zoom 1", () => {
    expect(cropRectFor(INITIAL_TRANSFORM, portrait)).toEqual({ sx: 0, sy: 500, size: 1000 });
  });

  it("halves the selection at zoom 2", () => {
    expect(cropRectFor({ zoom: 2, offsetX: 0, offsetY: 0 }, square)).toEqual({
      sx: 225,
      sy: 225,
      size: 450,
    });
  });

  it("moves the selection opposite the pan (dragging right reveals the left edge)", () => {
    const t = clampTransform({ zoom: 1, offsetX: 99, offsetY: 0 }, landscape);
    expect(cropRectFor(t, landscape)).toEqual({ sx: 0, sy: 0, size: 2000 });
  });

  it("never selects outside the source", () => {
    for (const zoom of [1, 1.7, 3, AVATAR_MAX_ZOOM]) {
      for (const [ox, oy] of [
        [-99, -99],
        [99, 99],
      ]) {
        const t = clampTransform({ zoom, offsetX: ox, offsetY: oy }, landscape);
        const rect = cropRectFor(t, landscape);
        expect(rect.sx).toBeGreaterThanOrEqual(0);
        expect(rect.sy).toBeGreaterThanOrEqual(0);
        expect(rect.sx + rect.size).toBeLessThanOrEqual(landscape.width);
        expect(rect.sy + rect.size).toBeLessThanOrEqual(landscape.height);
      }
    }
  });
});

describe("outputSizeFor", () => {
  it("caps at the output square", () => {
    expect(outputSizeFor(4000)).toBe(AVATAR_OUTPUT_PX);
  });

  it("never upscales a smaller selection", () => {
    expect(outputSizeFor(200)).toBe(200);
    expect(outputSizeFor(199.6)).toBe(200);
  });
});

describe("outputTypeFor", () => {
  it("keeps PNG so a transparent avatar stays transparent", () => {
    expect(outputTypeFor("image/png")).toBe("image/png");
  });

  it("re-encodes everything else as JPEG", () => {
    expect(outputTypeFor("image/jpeg")).toBe("image/jpeg");
    expect(outputTypeFor("image/webp")).toBe("image/jpeg");
    expect(outputTypeFor("")).toBe("image/jpeg");
  });
});

describe("croppedFileName", () => {
  it("names the upload by its output type, not the source's", () => {
    expect(croppedFileName("image/png")).toBe("avatar.png");
    expect(croppedFileName("image/jpeg")).toBe("avatar.jpg");
  });
});
