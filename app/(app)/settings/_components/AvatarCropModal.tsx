"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AVATAR_MAX_ZOOM,
  AVATAR_MIN_ZOOM,
  clampTransform,
  cropRectFor,
  displayedSize,
  INITIAL_TRANSFORM,
  renderCroppedAvatar,
  type CropTransform,
  type NaturalSize,
} from "@/lib/avatar-crop";

/**
 * Avatar crop modal.
 *
 * Stands between picking a file and uploading it: the user zooms and drags the
 * photo behind a circular viewport, and only the square that shows through is
 * uploaded (re-encoded to a small avatar-sized image by `renderCroppedAvatar`).
 * Cancel discards the pick entirely — nothing reaches the API until Save.
 *
 * Dismissal ergonomics mirror the other modals: Escape, backdrop click,
 * explicit Close. Body scroll locks while open.
 */

/** How far one arrow-key press pans, in viewport units. */
const KEY_PAN_STEP = 0.05;

export function AvatarCropModal({
  file,
  onCancel,
  onSave,
}: {
  file: File;
  onCancel: () => void;
  /** Receives the cropped image. Throwing keeps the modal open. */
  onSave: (cropped: File) => Promise<void>;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const [transform, setTransform] = useState<CropTransform>(INITIAL_TRANSFORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One object URL per picked file, revoked on unmount. Data URLs would copy
  // the whole photo through a base64 string for no benefit.
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onCancel();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onCancel, saving]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Every mutation goes through the clamp, so the viewport can never uncover
  // the image — including when a zoom-out shrinks the legal offset range.
  const move = useCallback(
    (next: (t: CropTransform) => CropTransform) => {
      if (!natural) return;
      setTransform((t) => clampTransform(next(t), natural));
    },
    [natural],
  );

  // Drag to pan. Pointer capture keeps the gesture alive when the cursor
  // leaves the box; the box's measured width converts pixels to viewport
  // units, which is the only place pixels enter the geometry.
  const drag = useRef<{ id: number; x: number; y: number; box: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!natural || saving) return;
    const box = e.currentTarget.getBoundingClientRect().width;
    if (!box) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, box };
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = (e.clientX - d.x) / d.box;
    const dy = (e.clientY - d.y) / d.box;
    d.x = e.clientX;
    d.y = e.clientY;
    move((t) => ({ ...t, offsetX: t.offsetX + dx, offsetY: t.offsetY + dy }));
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const pan: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_PAN_STEP, 0],
      ArrowRight: [KEY_PAN_STEP, 0],
      ArrowUp: [0, -KEY_PAN_STEP],
      ArrowDown: [0, KEY_PAN_STEP],
    };
    const delta = pan[e.key];
    if (!delta) return;
    e.preventDefault();
    move((t) => ({ ...t, offsetX: t.offsetX + delta[0], offsetY: t.offsetY + delta[1] }));
  }

  async function save() {
    const image = imgRef.current;
    if (!image || !natural || saving) return;
    setSaving(true);
    setError(null);
    try {
      const cropped = await renderCroppedAvatar(image, cropRectFor(transform, natural), file.type);
      await onSave(cropped);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save avatar");
      setSaving(false);
    }
  }

  // Positioned in percentages of the image's own box so the geometry needs no
  // measured viewport size: width is a multiple of the (square) container's
  // edge, and the offsets are re-expressed as a fraction of that width.
  const size = natural ? displayedSize(natural, transform.zoom) : { width: 1, height: 1 };
  const imageStyle: React.CSSProperties = {
    width: `${size.width * 100}%`,
    transform: `translate(calc(-50% + ${(transform.offsetX / size.width) * 100}%), calc(-50% + ${
      (transform.offsetY / size.height) * 100
    }%))`,
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="avatar-crop-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !saving && onCancel()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="avatar-crop-title" className="text-base font-semibold">
              Crop your avatar
            </h2>
            <p className="text-xs text-[var(--muted)]">
              Drag to reposition, zoom to fill the circle.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div
            role="application"
            aria-label="Crop area — drag to reposition, arrow keys to nudge"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={onKeyDown}
            className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-lg bg-[var(--surface-2)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--accent)]"
            style={{ cursor: natural ? "grab" : "default" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={url}
              alt="Avatar preview"
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                setNatural({ width: el.naturalWidth, height: el.naturalHeight });
                setTransform(INITIAL_TRANSFORM);
              }}
              onError={() => setError("That image couldn't be opened.")}
              className="absolute left-1/2 top-1/2 max-w-none"
              style={imageStyle}
            />
            {/* Circular mask: the huge spread shadow dims everything outside
                the circle without a second element or an SVG clip path. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full border border-white/40"
              style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
            />
          </div>

          <label className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
              Zoom
            </span>
            <input
              type="range"
              aria-label="Zoom"
              min={AVATAR_MIN_ZOOM}
              max={AVATAR_MAX_ZOOM}
              step={0.01}
              value={transform.zoom}
              disabled={!natural || saving}
              onChange={(e) => move((t) => ({ ...t, zoom: Number(e.target.value) }))}
              className="h-1 w-full flex-1 cursor-pointer appearance-none rounded-full bg-[var(--surface-2)] accent-[var(--accent)] disabled:opacity-50"
            />
          </label>

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!natural || saving}
            className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save avatar"}
          </button>
        </footer>
      </div>
    </div>
  );
}
