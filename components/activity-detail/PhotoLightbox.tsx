"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ActivityPhoto } from "@/lib/api";

/**
 * A full-screen lightbox for an activity's photos. Reuses the app's modal
 * grammar (dark backdrop, `role="dialog"` + `aria-modal`, Escape-to-close,
 * body-scroll lock, backdrop click) from WorkoutDetailsEditModal, and adds
 * media-viewer affordances: previous/next controls, ArrowLeft/ArrowRight
 * navigation, and a caption rendered beneath the image.
 *
 * Focus is TRAPPED within the dialog — the dialog shell is focused on open and
 * Tab is kept inside it — so keyboard users can't wander behind the overlay.
 *
 * The full-size (`url`) variant is shown `object-contain` within a
 * `max-h-[90vh] max-w-[90vw]` box; `alt` prefers the photo's caption and falls
 * back to a generated description from `activityName`.
 */
export function PhotoLightbox({
  photos,
  index,
  activityName,
  onIndexChange,
  onClose,
}: {
  photos: ActivityPhoto[];
  index: number;
  activityName: string;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const count = photos.length;
  const hasPrev = index > 0;
  const hasNext = index < count - 1;

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index < count - 1) onIndexChange(index + 1);
  }, [index, count, onIndexChange]);

  // Escape closes; arrows navigate. Focus is trapped by keeping Tab within the
  // dialog shell (there's exactly one focusable node — the shell itself — so we
  // simply hold focus on it).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        goPrev();
      } else if (e.key === "ArrowRight") {
        goNext();
      } else if (e.key === "Tab") {
        // Trap focus: there's a single focusable element (the shell), so keep
        // focus on it regardless of Tab / Shift+Tab direction.
        e.preventDefault();
        dialogRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, goPrev, goNext]);

  // Lock body scroll while open (same pattern as the edit modal).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Move focus into the dialog on open so the keyboard handlers and the trap
  // have somewhere to keep it.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const photo = photos[index];
  if (!photo) return null;

  const alt = photo.caption?.trim() ? photo.caption : `Photo from ${activityName}`;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 outline-none"
      role="dialog"
      aria-modal="true"
      aria-label="Photo viewer"
      tabIndex={-1}
    >
      <div className="absolute inset-0 bg-black/85" onClick={onClose} aria-hidden="true" />

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 rounded-full border border-white/20 bg-black/40 p-2 text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      >
        <CloseIcon />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={goPrev}
          aria-label="Previous photo"
          className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <ChevronIcon direction="left" />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={goNext}
          aria-label="Next photo"
          className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-white/20 bg-black/40 p-2 text-white/80 transition hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <ChevronIcon direction="right" />
        </button>
      )}

      <figure className="relative z-0 flex max-h-[90vh] max-w-[90vw] flex-col items-center gap-3">
        {/* Presigned S3 URLs are arbitrary remote hosts; next/image would need
            per-host remotePatterns, so a plain <img> is the right call (matches
            the Avatar / sidebar pattern). */}
        {photo.url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.url}
            alt={alt}
            className="max-h-[80vh] max-w-[90vw] rounded-[14px] object-contain"
          />
        ) : (
          <div className="flex h-[40vh] w-[60vw] items-center justify-center rounded-[14px] bg-white/5 text-sm text-white/70">
            Still processing&hellip;
          </div>
        )}
        {photo.caption?.trim() && (
          <figcaption className="max-w-[90vw] text-center text-sm text-white/80">
            {photo.caption}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === "left" ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}
