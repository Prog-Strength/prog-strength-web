"use client";

import { useRef, useState } from "react";
import { getToken } from "@/lib/auth";
import {
  completeActivityVideo,
  deleteActivityVideo,
  reorderActivityVideos,
  reserveActivityVideo,
  updateActivityVideoCaption,
  uploadVideoToStorage,
  type ActivityVideo,
} from "@/lib/api";
import { formatVideoDuration, likelyUnplayable, probeVideo } from "@/lib/video-poster";
import { useToast } from "@/components/toast";

// Client-side guards — UX only; the API and S3 are authoritative. Catching here
// gives a snappier rejection than a round-trip plus a long upload.
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024; // 1 GiB, matching videos.max_upload_bytes
const ALLOWED_VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

/**
 * The activity-detail video strip — the STANDARD keepsake-video surface for
 * every activity detail page, not one of them. Rendered on `/workouts/[id]`,
 * `/running/[id]`, and `/hiking/[id]`, and on whatever route a future activity
 * type adds. Videos hang off the activities base row, so the API returns them
 * for every type; a page that doesn't render this silently offers no way to
 * attach one. That is exactly the bug the photo rollout shipped
 * (prog-strength-web#135) — see sows/activity-videos.md § Route coverage.
 *
 * Upload is three steps, because the bytes go around the API rather than
 * through it (a 400 MB clip can't buffer on the host):
 *
 *   1. `reserveActivityVideo` → a presigned S3 PUT
 *   2. `uploadVideoToStorage` → the browser PUTs directly, with real progress
 *   3. `completeActivityVideo` → confirms the object, attaches the poster
 *
 * The poster frame is captured client-side (`probeVideo`) because frame
 * extraction needs ffmpeg, which the server's pure-Go pipeline avoids. It is
 * best-effort throughout: a browser that can't decode the container still
 * uploads the file and simply gets no poster.
 */
export function VideoStrip({
  videos,
  activityId,
  activityName,
  isOwner,
  onVideosChanged,
}: {
  videos: ActivityVideo[];
  activityId: string;
  activityName: string;
  isOwner: boolean;
  onVideosChanged: () => void;
}) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [playing, setPlaying] = useState<ActivityVideo | null>(null);

  // Nothing to show and nothing to add: render nothing at all.
  if (videos.length === 0 && !isOwner) return null;

  const uploading = uploadPct !== null;

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!ALLOWED_VIDEO_TYPES.has(file.type)) {
      toast.error("Use an MP4 or QuickTime (.mov) video.");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast.error("Video must be under 1 GB.");
      return;
    }
    const token = getToken();
    if (!token) return;

    setUploadPct(0);
    try {
      // Probe first: metadata and the poster both come from the local file, and
      // neither failing should stop the upload.
      const probe = await probeVideo(file);

      const reservation = await reserveActivityVideo(token, activityId, {
        content_type: file.type,
        byte_size: file.size,
        duration_seconds: probe.durationSeconds,
        width: probe.width,
        height: probe.height,
      });

      await uploadVideoToStorage(reservation.upload_url, file, (f) =>
        setUploadPct(Math.round(f * 100)),
      );

      await completeActivityVideo(token, activityId, reservation.video_id, probe.poster);

      if (!probe.poster) {
        toast.error("Video saved, but this browser couldn't make a preview frame.");
      }
      onVideosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload video");
    } finally {
      setUploadPct(null);
    }
  };

  const handleDelete = async (videoId: string) => {
    const token = getToken();
    if (!token) return;
    try {
      await deleteActivityVideo(token, activityId, videoId);
      onVideosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete video");
    }
  };

  const handleSaveCaption = async (videoId: string, caption: string) => {
    const token = getToken();
    if (!token) return;
    const trimmed = caption.trim();
    try {
      await updateActivityVideoCaption(token, activityId, videoId, trimmed === "" ? null : trimmed);
      onVideosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save caption");
    }
  };

  // Move one slot, then persist the WHOLE new order in a single call — the
  // endpoint expects the complete id list and 400s on a partial one.
  const handleMove = async (from: number, direction: -1 | 1) => {
    const to = from + direction;
    if (to < 0 || to >= videos.length) return;
    const reordered = [...videos];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    const token = getToken();
    if (!token) return;
    try {
      await reorderActivityVideos(
        token,
        activityId,
        reordered.map((v) => v.id),
      );
      onVideosChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reorder videos");
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--faint)]">
          Videos
        </p>
        {isOwner && (
          <div className="flex items-center gap-3">
            {videos.length > 0 && (
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
              {uploading ? `Uploading… ${uploadPct}%` : "+ Add video"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/quicktime"
              aria-label="Add video"
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

      {/* A real progress bar: a 400 MB upload with no feedback reads as a hang. */}
      {uploading && (
        <div
          className="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]"
          role="progressbar"
          aria-label="Video upload progress"
          aria-valuenow={uploadPct ?? 0}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200"
            style={{ width: `${uploadPct}%` }}
          />
        </div>
      )}

      {videos.length === 0 ? (
        <p className="text-sm italic text-[var(--faint)]">No videos on this session yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-3">
          {videos.map((video, i) => (
            <li key={video.id} className="flex w-40 shrink-0 flex-col gap-1.5">
              <VideoThumbnail
                video={video}
                activityName={activityName}
                onOpen={() => setPlaying(video)}
              />
              {editing && isOwner && (
                <VideoEditRow
                  index={i}
                  total={videos.length}
                  caption={video.caption ?? ""}
                  onMove={(dir) => void handleMove(i, dir)}
                  onDelete={() => void handleDelete(video.id)}
                  onSaveCaption={(c) => void handleSaveCaption(video.id, c)}
                />
              )}
              {!editing && video.caption && (
                <p className="line-clamp-2 text-xs text-[var(--muted)]">{video.caption}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {playing && <VideoPlayerModal video={playing} onClose={() => setPlaying(null)} />}
    </section>
  );
}

/**
 * A poster thumbnail in an aspect-ratio box computed from the stored
 * dimensions, so the strip reserves its layout before the image loads and the
 * page doesn't reflow. Falls back to a neutral placeholder when the poster is
 * null — which is a real, expected state, not an error.
 */
function VideoThumbnail({
  video,
  activityName,
  onOpen,
}: {
  video: ActivityVideo;
  activityName: string;
  onOpen: () => void;
}) {
  const ratio = video.width && video.height ? `${video.width} / ${video.height}` : "4 / 3";
  const label = video.caption?.trim() ? video.caption : `Video from ${activityName}`;
  const duration = formatVideoDuration(video.duration_seconds);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play ${label}`}
      className="group relative w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface-2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      style={{ aspectRatio: ratio }}
    >
      {video.poster_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL; next/image would need a remote-pattern allowlist per bucket.
        <img
          src={video.poster_url}
          alt={label}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-[11px] text-[var(--faint)]">
          No preview
        </span>
      )}
      {/* Play affordance */}
      <span
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center bg-black/20 transition group-hover:bg-black/30"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
          ▶
        </span>
      </span>
      {duration && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] tabular-nums text-white"
        >
          {duration}
        </span>
      )}
    </button>
  );
}

/** Owner controls: reorder, caption, delete. Mirrors the photo strip's edit row. */
function VideoEditRow({
  index,
  total,
  caption,
  onMove,
  onDelete,
  onSaveCaption,
}: {
  index: number;
  total: number;
  caption: string;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
  onSaveCaption: (caption: string) => void;
}) {
  const [draft, setDraft] = useState(caption);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Move video left"
            className="px-1 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === total - 1}
            aria-label="Move video right"
            className="px-1 text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-30"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="text-[var(--danger)] hover:underline"
          aria-label="Delete video"
        >
          Delete
        </button>
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== caption && onSaveCaption(draft)}
        placeholder="Add a caption"
        aria-label="Video caption"
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--foreground)] placeholder:text-[var(--faint)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      />
    </div>
  );
}

/**
 * Full-screen playback. Deliberately a sibling of PhotoLightbox rather than a
 * generalization of it: a lightbox's prev/next paging is wrong for video (you
 * don't skim clips the way you skim photos), and `<video controls>` brings its
 * own keyboard handling that would fight a shared shell's arrow-key bindings.
 *
 * `preload="metadata"` matters here — the source is the untranscoded original,
 * so preloading the whole thing would pull hundreds of megabytes on open.
 */
function VideoPlayerModal({ video, onClose }: { video: ActivityVideo; onClose: () => void }) {
  const unplayable = likelyUnplayable(video.content_type);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Video player"
      onClick={onClose}
    >
      <div className="max-h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
        <video
          src={video.url}
          poster={video.poster_url ?? undefined}
          controls
          autoPlay
          preload="metadata"
          className="max-h-[80vh] w-full rounded-[var(--radius-card)] bg-black"
        />
        {unplayable && (
          <p className="mt-3 rounded-md border border-[var(--accent-line)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--muted)]">
            This browser may not play this video&apos;s format. It is stored at full original
            quality — try Safari, or download it.
          </p>
        )}
        {video.caption && <p className="mt-3 text-sm text-[var(--muted)]">{video.caption}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-3 text-xs text-[var(--accent)] hover:underline"
        >
          Close
        </button>
      </div>
    </div>
  );
}
