"use client";

import { useEffect, useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  deleteActivityPhoto,
  reorderActivityPhotos,
  updateActivityPhotoCaption,
  uploadActivityPhotoDirect,
  type ActivityPhoto,
} from "@/lib/api";
import { useToast } from "@/components/toast";
import { PhotoLightbox } from "./PhotoLightbox";

// Client-side upload guards — UX only; the API is authoritative on size,
// content type, and the per-activity cap. Catching here gives a snappier
// rejection than a round-trip. The cap mirrors the server's
// `photos.max_per_activity`.
const MAX_PHOTO_BYTES = 12 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_PHOTOS_PER_ACTIVITY = 10;

// Why a file did not attach, grouped for the batch's single failure toast.
// "unsupported format" and "file over 12 MB" are rejections — the user's move
// is to pick a different file. "upload error" is a network/server failure —
// retrying the same file is reasonable. The label pair is (singular, plural)
// because the toast counts each class.
const FAILURE_LABELS = {
  unsupportedType: ["unsupported format", "unsupported formats"],
  tooLarge: ["file over 12 MB", "files over 12 MB"],
  uploadError: ["upload error", "upload errors"],
} as const;
type FailureReason = keyof typeof FAILURE_LABELS;
type UploadFailure = { name: string; reason: FailureReason };

/** One grouped message: "3 photos failed — 1 unsupported format, 2 upload errors." */
function describeFailures(failures: UploadFailure[]): string {
  const parts = (Object.keys(FAILURE_LABELS) as FailureReason[])
    .map((reason) => ({ reason, count: failures.filter((f) => f.reason === reason).length }))
    .filter(({ count }) => count > 0)
    .map(({ reason, count }) => `${count} ${FAILURE_LABELS[reason][count === 1 ? 0 : 1]}`);
  return `${failures.length} photo${failures.length === 1 ? "" : "s"} failed — ${parts.join(", ")}.`;
}

/**
 * The activity-detail photo strip: a horizontal row of thumbnails, each in an
 * aspect-ratio box (computed from `width`/`height`) so layout is reserved
 * before the image loads — no reflow on load. Clicking a thumbnail opens the
 * lightbox at that index. Photos arrive ordered by `position`; the strip
 * renders them in the order given.
 *
 * When `isOwner`, the strip grows owner affordances:
 *   - an Add button that opens a hidden multi-select file input. An over-cap
 *     selection is refused up front; otherwise each file is validated on
 *     type/size (a bad file is skipped, never aborting the batch) and the
 *     valid ones upload sequentially via `uploadActivityPhotoDirect` (reserve
 *     → S3 PUT → commit), with per-photo "N of M — %" progress, a refresh via
 *     `onPhotosChanged` after each commit, and one grouped failure toast;
 *   - an Edit toggle exposing per-photo delete, inline caption edit, and
 *     move-left / move-right reordering — the latter reorders locally and
 *     issues ONE `reorderActivityPhotos` call with the complete id list.
 *
 * Upload API errors (413 file_too_large, 409 photo_limit_reached, 503, …) are
 * counted into the batch's grouped failure toast as upload errors — the
 * specific message goes to the console, not the user. Errors from the edit
 * affordances (delete, caption, reorder) still surface their own message as an
 * error toast, mirroring the Settings avatar upload.
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
  // Non-null while a batch is in flight: which photo is uploading (1-based),
  // how many the batch holds, and the current file's S3 PUT fraction (0..1).
  // "Uploading 3 of 8 — 62%" is literally true because uploads are sequential.
  const [batchProgress, setBatchProgress] = useState<{
    index: number;
    total: number;
    fraction: number;
  } | null>(null);

  // A photo committed but not yet rendered sits in `processing`. The server
  // finishes it on a background worker, so nothing pushes the result here —
  // poll until none are left.
  //
  // Polling beats anything push-based for this: it is a handful of requests
  // over a few seconds, on a page the user is already looking at, and it needs
  // no connection to keep alive.
  const hasProcessing = photos.some((p) => p.status === "processing");
  useEffect(() => {
    if (!hasProcessing) return;
    const id = setInterval(onPhotosChanged, 2000);
    return () => clearInterval(id);
  }, [hasProcessing, onPhotosChanged]);
  const [editing, setEditing] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Nothing to show and nothing to add: render nothing at all.
  if (photos.length === 0 && !isOwner) return null;

  const handleFiles = async (fileList: FileList | null) => {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;

    // Cap check runs before anything uploads. Refusing the whole selection up
    // front beats filling the remaining slots in selection order, which would
    // silently pick winners.
    const remaining = MAX_PHOTOS_PER_ACTIVITY - photos.length;
    if (files.length > remaining) {
      // A full strip gets its own wording — "You can add 0 more photos" reads
      // like a riddle when the real answer is "the activity is full".
      toast.error(
        remaining <= 0
          ? `This activity already has the maximum of ${MAX_PHOTOS_PER_ACTIVITY} photos.`
          : `You can add ${remaining} more photo${remaining === 1 ? "" : "s"} — you selected ${files.length}.`,
      );
      return;
    }

    const token = getToken();
    if (!token) return;

    // Per-file validation: a bad file is recorded and skipped — one HEIC in a
    // selection of eight must not cost the other seven.
    const failures: UploadFailure[] = [];
    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_PHOTO_TYPES.has(file.type)) {
        failures.push({ name: file.name, reason: "unsupportedType" });
      } else if (file.size > MAX_PHOTO_BYTES) {
        failures.push({ name: file.name, reason: "tooLarge" });
      } else {
        valid.push(file);
      }
    }

    // Sequential on purpose: parallel uploads contend for the same upstream,
    // let position assignment interleave, and turn "photo 3 of 8" into a
    // fiction. Each iteration owns its try/catch so one failure cannot abort
    // the rest — three phases per file: reserve, PUT straight to S3, commit.
    for (const [i, file] of valid.entries()) {
      setBatchProgress({ index: i + 1, total: valid.length, fraction: 0 });
      try {
        await uploadActivityPhotoDirect(token, activityId, file, {
          onProgress: (fraction) =>
            setBatchProgress({ index: i + 1, total: valid.length, fraction }),
        });
        // Refresh after every commit, not once at the end — each photo appears
        // in the strip (as a processing placeholder) the moment it lands.
        onPhotosChanged();
      } catch (err) {
        // The grouped toast stays terse on purpose, so the specific error
        // (status code, server message) lands in the console for debugging.
        console.error("photo upload failed", file.name, err);
        failures.push({ name: file.name, reason: "uploadError" });
      }
    }
    setBatchProgress(null);

    if (failures.length > 0) {
      toast.error(describeFailures(failures));
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
              disabled={batchProgress !== null}
              className="text-xs text-[var(--accent)] hover:underline disabled:opacity-40"
            >
              {batchProgress
                ? `Uploading ${batchProgress.index} of ${batchProgress.total} — ${Math.round(batchProgress.fraction * 100)}%`
                : "+ Add photos"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              aria-label="Add photos"
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
      {photo.thumb_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={photo.thumb_url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        /* Still processing: the objects do not exist yet, so there is nothing
           to show. A shimmer in the photo's final position reads as "not
           finished", where a broken <img> would read as "lost". */
        <span
          aria-label="Photo processing"
          className="block h-full w-full animate-pulse bg-white/10"
        />
      )}
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
