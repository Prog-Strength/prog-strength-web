/**
 * Client-side poster-frame capture.
 *
 * The server cannot do this: extracting a frame from a video needs ffmpeg, and
 * the API's media pipeline is deliberately pure Go with no cgo (see
 * prog-strength-docs/sows/activity-videos.md). So the browser decodes one
 * frame, draws it to a canvas, and uploads the result as a normal JPEG — which
 * then runs through the SAME server-side image pipeline photos use, so it still
 * gets its EXIF stripped and its dimensions bounded. The server stays
 * authoritative over the one artifact it can actually process.
 *
 * Every failure path returns null rather than throwing. A poster is a nicety;
 * the video is the keepsake. A browser that can't decode the container (HEVC in
 * Chrome, most often) must still be able to store the file.
 */

/** How far into the clip to seek. 0 often lands on a black or blurred frame. */
const POSTER_SEEK_SECONDS = 0.5;

/** Give up rather than hang if the video never reaches a drawable state. */
const POSTER_TIMEOUT_MS = 10_000;

export type VideoProbe = {
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  /** The captured frame, or null when this browser couldn't decode one. */
  poster: Blob | null;
};

/**
 * Loads `file` into a detached <video>, reads its intrinsic metadata, and
 * captures a poster frame. Resolves with nulls for whatever couldn't be
 * determined; never rejects.
 */
export function probeVideo(file: File): Promise<VideoProbe> {
  return new Promise((resolve) => {
    // jsdom and non-browser contexts have no createObjectURL; degrade quietly.
    if (typeof document === "undefined" || typeof URL?.createObjectURL !== "function") {
      resolve({ durationSeconds: null, width: null, height: null, poster: null });
      return;
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    let settled = false;

    const finish = (probe: VideoProbe) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      resolve(probe);
    };

    // Metadata is worth keeping even when the frame grab fails — the strip can
    // still reserve the right aspect ratio and show a duration badge.
    const metadata = () => ({
      durationSeconds: Number.isFinite(video.duration) ? video.duration : null,
      width: video.videoWidth || null,
      height: video.videoHeight || null,
    });

    const timer = setTimeout(() => finish({ ...metadata(), poster: null }), POSTER_TIMEOUT_MS);

    video.onerror = () =>
      finish({ durationSeconds: null, width: null, height: null, poster: null });

    video.onloadedmetadata = () => {
      // Seek a little in; clamp for clips shorter than the seek target.
      const target = Math.min(POSTER_SEEK_SECONDS, (video.duration || 0) / 2);
      if (Number.isFinite(target) && target > 0) {
        video.currentTime = target;
      } else {
        video.currentTime = 0;
      }
    };

    video.onseeked = () => {
      const meta = metadata();
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx || !canvas.width || !canvas.height) {
          finish({ ...meta, poster: null });
          return;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish({ ...meta, poster: blob }), "image/jpeg", 0.9);
      } catch {
        // Tainted canvas or a codec the browser decodes but won't paint.
        finish({ ...meta, poster: null });
      }
    };

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
  });
}

/** Formats a duration as m:ss for the strip's badge. */
export function formatVideoDuration(seconds: number | null): string {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/**
 * Whether a stored video is likely unplayable in THIS browser.
 *
 * Nothing is transcoded, so an iPhone's default HEVC recording is stored as
 * HEVC — which Safari plays and Chrome/Firefox generally do not. Rather than
 * reject the upload (losing a moment that can't be re-recorded), the strip
 * stores it and says so. `canPlayType` returning "" means "no support".
 */
export function likelyUnplayable(contentType: string): boolean {
  if (typeof document === "undefined") return false;
  const probe = document.createElement("video");
  if (typeof probe.canPlayType !== "function") return false;
  // A bare container type over-reports support, so ask about the codec that
  // actually causes trouble; fall back to the container.
  const hevc = probe.canPlayType('video/mp4; codecs="hvc1"');
  const container = probe.canPlayType(contentType);
  return container === "" && hevc === "";
}
