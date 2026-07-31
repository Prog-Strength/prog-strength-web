"use client";

import { useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  deleteActivityPhoto,
  reorderActivityPhotos,
  updateActivityPhotoCaption,
  uploadActivityPhoto,
  type ActivityPhoto,
} from "@/lib/api";
import { useToast } from "@/components/toast";
import { PhotoLightbox } from "./PhotoLightbox";

// Client-side upload guards — UX only; the API is authoritative on size and
// content type. Catching here gives a snappier rejection than a round-trip.
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * The activity-detail photo strip: a horizontal row of thumbnails, each in an
 * aspect-ratio box (computed from `width`/`height`) so layout is reserved
 * before the image loads — no reflow on load. Clicking a thumbnail opens the
 * lightbox at that index. Photos arrive ordered by `position`; the strip
 * renders them in the order given.
 *
 * When `isOwner`, the strip grows owner affordances:
 *   - an Add button that opens a hidden file input, pre-checks type/size, then
 *     uploads via `uploadActivityPhoto` and refreshes via `onPhotosChanged`;
 *   - an Edit toggle exposing per-photo delete, inline caption edit, and
 *     move-left / move-right reordering — the latter reorders locally and
 *     issues ONE `reorderActivityPhotos` call with the complete id list.
 *
 * API errors (413 file_too_large, 415, 409 photo_limit_reached, 503, …) surface
 * as an error toast, mirroring the Settings avatar upload.
 */
export function PhotoStrip({
  photos,
  activityId,
  activityName,
  isOwner,
  onPhotosChanged,
}: {
  photos: ActivityPhoto[];
  activityId: string;
  activityName: string;
  isOwner: boolean;
  onPhotosChanged: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Nothing to show and nothing to add: render nothing at all.
  if (photos.length === 0 && !isOwner) return null;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
      toast.error("Use JPG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error("Image must be under 12 MB.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setUploading(true);
    try {
      await uploadActivityPhoto(token, activityId, file);
      onPhotosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (photoId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteActivityPhoto(token, activityId, photoId);
      onPhotosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete photo");
    }
  };

  const handleSaveCaption = async (photoId: string, caption: string) => {
    const token = getToken();
    if (!token) return;
    const trimmed = caption.trim();
    try {
      await updateActivityPhotoCaption(token, activityId, photoId, trimmed === "" ? null : trimmed);
      onPhotosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save caption");
    }
  };

  // Move a photo one slot in `direction`, then persist the WHOLE new order in a
  // single reorder call (the endpoint expects the complete id list).
  const handleMove = async (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= photos.length) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const token = getToken();
    if (!token) return;
    try {
      await reorderActivityPhotos(
        token,
        activityId,
        reordered.map((p) => p.id),
      );
      onPhotosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder photos");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Photos
        </p>
        {isOwner && (
          <div className="flex items-center gap-3">
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => setEditing((v) => !v)}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {editing ? "Done" : "Edit"}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-[var(--accent)] hover:underline disabled:opacity-40"
            >
              {uploading ? "Uploading…" : "+ Add photo"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              aria-label="Add photo"
              className="hidden"
              onChange={(e) => {
                void handleFiles(e.target.files);
                // Reset so re-selecting the same file re-fires onChange.
                e.target.value = "";
              }}
            />
          </div>
        )}
      </div>

      {photos.length === 0 ? (
        <p className="text-sm italic text-[var(--faint)]">No photos on this session yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {photos.map((photo, i) => (
            <li key={photo.id} className="flex w-40 shrink-0 flex-col gap-1.5">
              <Thumbnail
                photo={photo}
                activityName={activityName}
                onOpen={() => setLightboxIndex(i)}
              />
              {editing && (
                <PhotoEditControls
                  photo={photo}
                  isFirst={i === 0}
                  isLast={i === photos.length - 1}
                  onMoveLeft={() => handleMove(i, -1)}
                  onMoveRight={() => handleMove(i, 1)}
                  onDelete={() => handleDelete(photo.id)}
                  onSaveCaption={(caption) => handleSaveCaption(photo.id, caption)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          activityName={activityName}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </section>
  );
}

/**
 * A single thumbnail button. The `aspect-ratio` box (from the photo's intrinsic
 * dimensions) reserves layout so the image doesn't reflow the strip on load.
 */
function Thumbnail({
  photo,
  activityName,
  onOpen,
}: {
  photo: ActivityPhoto;
  activityName: string;
  onOpen: () => void;
}) {
  const alt = photo.caption?.trim() ? photo.caption : `Photo from ${activityName}`;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`View ${alt}`}
      className="block w-full overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface)] transition hover:border-[var(--accent-line)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
    >
      {/* Presigned S3 URLs are arbitrary remote hosts; next/image would need
          per-host remotePatterns, so a plain <img> is the right call here
          (matches the Avatar / sidebar pattern). */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.thumb_url} alt={alt} className="h-full w-full object-cover" />
    </button>
  );
}

/**
 * Per-photo owner controls shown in edit mode: caption edit (commits on blur /
 * Enter), move-left / move-right (disabled at the ends), and delete.
 */
function PhotoEditControls({
  photo,
  isFirst,
  isLast,
  onMoveLeft,
  onMoveRight,
  onDelete,
  onSaveCaption,
}: {
  photo: ActivityPhoto;
  isFirst: boolean;
  isLast: boolean;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onDelete: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");

  const commit = () => {
    if (caption !== (photo.caption ?? "")) onSaveCaption(caption);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="text"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Add a caption"
        aria-label="Photo caption"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveLeft}
            disabled={isFirst}
            aria-label="Move left"
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onMoveRight}
            disabled={isLast}
            aria-label="Move right"
            className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-30"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete photo"
          className="rounded border border-[var(--danger)]/35 px-1.5 py-0.5 text-xs text-[var(--danger)] transition hover:bg-[var(--danger)]/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
