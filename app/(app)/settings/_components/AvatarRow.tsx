"use client";

import { useRef, useState } from "react";
import { useToast } from "@/components/toast";
import { initialsOf } from "./draft";
import { AvatarCropModal } from "./AvatarCropModal";

/**
 * Avatar editor: a preview (current image or initials placeholder), a file
 * picker, and a Remove button when an avatar is set. Immediate / out-of-band —
 * not part of the settings draft, so it never touches the SaveBar.
 *
 * Picking a file opens the crop modal rather than uploading straight away: the
 * upload is whatever square the user framed there, re-encoded small. Cancelling
 * the crop discards the pick, so nothing reaches the API until they say so.
 */

// Client-side guards on the SOURCE file — UX only; the API is authoritative
// (its [avatar] max_upload_bytes, image/png|jpeg|webp). Catching here gives a
// snappier rejection than a round-trip. The cropped upload is far smaller than
// this; the limit is what a user may pick to crop FROM.
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function AvatarRow({
  avatarUrl,
  displayName,
  disabled,
  onUpload,
  onRemove,
}: {
  avatarUrl: string | null;
  displayName: string;
  disabled: boolean;
  /** Uploads the cropped image. Rejections surface as a toast. */
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  // The picked-but-not-yet-cropped source file. Non-null ⇒ the crop modal is up.
  const [pending, setPending] = useState<File | null>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset the input so picking the same file again still fires change.
    e.target.value = "";
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.has(file.type)) {
      toast.error("Use PNG, JPG, or WebP.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Image must be under 5 MB.");
      return;
    }
    setPending(file);
  }

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to remove avatar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <AvatarPreview url={avatarUrl} name={displayName} />
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium">Avatar</p>
          <p className="text-xs text-[var(--muted)]">PNG, JPG, or WebP, up to 5 MB.</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload avatar"
          onChange={handlePick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-md bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--accent-fg)] transition hover:opacity-80 disabled:opacity-50"
        >
          {busy ? "Working…" : avatarUrl ? "Change" : "Upload"}
        </button>
        {avatarUrl && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled || busy}
            className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium transition hover:opacity-80 disabled:opacity-50"
          >
            Remove
          </button>
        )}
      </div>

      {pending && (
        <AvatarCropModal
          file={pending}
          onCancel={() => setPending(null)}
          onSave={async (cropped) => {
            // Throwing keeps the modal open with its own error line, so a
            // failed upload doesn't cost the user their framing.
            await onUpload(cropped);
            setPending(null);
          }}
        />
      )}
    </div>
  );
}

function AvatarPreview({ url, name }: { url: string | null; name: string }) {
  if (url) {
    // Presigned S3 / OAuth URLs are arbitrary remote hosts; next/image would
    // require per-host remotePatterns config.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`${name.trim() || "Account"} avatar`}
        className="h-12 w-12 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--surface)] text-sm font-semibold uppercase text-[var(--foreground)]"
    >
      {initialsOf(name)}
    </span>
  );
}
