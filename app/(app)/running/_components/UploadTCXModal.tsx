"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DuplicateRunError,
  importActivityTcx,
  type ActivityType,
  type RunningSession,
} from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";

/** The sports selectable in the upload pill row, in display order. */
type UploadSport = "running" | "hiking" | "walking" | "cycling";

const SPORTS: { id: UploadSport; label: string }[] = [
  { id: "running", label: "Run" },
  { id: "hiking", label: "Hike" },
  { id: "walking", label: "Walk" },
  { id: "cycling", label: "Ride" },
];

/**
 * Upload-a-TCX modal. Mirrors the delete-modal pattern (fixed overlay,
 * Escape-to-close, body overflow lock, header + close button). Accepts a
 * single .tcx via either a file picker or a drag-and-drop zone.
 *
 * Lifecycle: idle → uploading → success (calls onUploaded + closes) or
 * error (inline message, stays open to retry). A 409 from the API is
 * surfaced specially as a "already in your log" message with a link to
 * the existing run rather than a generic error.
 */
export function UploadTCXModal({
  onClose,
  onUploaded,
  defaultSport,
}: {
  onClose: () => void;
  onUploaded: (session: RunningSession) => void;
  defaultSport: UploadSport;
}) {
  const router = useRouter();
  const [sport, setSport] = useState<UploadSport>(defaultSport);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the API reports the run is already imported — carries the
  // existing session id so we can render a "View run" link.
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, busy]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  function upload(file: File) {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    setError(null);
    setDuplicateId(null);
    importActivityTcx(token, file, sport satisfies ActivityType)
      .then((session) => {
        onUploaded(session);
        onClose();
      })
      .catch((err: unknown) => {
        if (err instanceof DuplicateRunError) {
          setDuplicateId(err.existingActivityId);
          return;
        }
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.toLowerCase().includes("401")) {
          clearToken();
          router.replace("/login");
          return;
        }
        setError(msg);
      })
      .finally(() => setBusy(false));
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) upload(file);
    // Reset so picking the same file again re-fires onChange.
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (busy) return;
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-tcx-modal-title"
    >
      <div
        className="absolute inset-0 bg-black/60"
        onClick={() => !busy && onClose()}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-md flex-col overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--background)] shadow-xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3">
          <h2 id="upload-tcx-modal-title" className="text-base font-semibold">
            Upload TCX
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface)] hover:text-[var(--foreground)] disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="flex flex-col gap-3 px-5 py-4">
          {/* Sport selector: the imported TCX carries a sport hint, but the
              user picks the activity type explicitly so a walk isn't logged
              as a run. Styled like the shell's timeframe pills. */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Activity type">
            {SPORTS.map((s) => {
              const active = s.id === sport;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => setSport(s.id)}
                  aria-pressed={active}
                  className={`rounded-full px-3 py-1 text-xs transition disabled:opacity-50 ${
                    active
                      ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                      : "border border-[var(--border)] bg-[var(--surface)] text-[var(--faint)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!busy) setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center transition disabled:opacity-60 ${
              dragOver
                ? "border-[var(--accent)] bg-[var(--surface-2)]"
                : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {busy ? (
              <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Spinner /> Uploading…
              </span>
            ) : (
              <>
                <span className="text-sm font-medium">Drop a .tcx file here</span>
                <span className="text-xs text-[var(--muted)]">or click to browse</span>
              </>
            )}
          </button>

          <input
            ref={inputRef}
            type="file"
            accept=".tcx,application/xml"
            className="hidden"
            onChange={onPick}
          />

          {duplicateId && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
              <p>This activity is already in your log.</p>
              <Link
                href={duplicateHref(sport, duplicateId)}
                onClick={onClose}
                className="mt-1 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
              >
                View activity →
              </Link>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          <p className="text-xs text-[var(--muted)]">
            Export the activity from Garmin Connect as a .tcx file, then upload it here.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Where the "View activity" link points for a 409 duplicate. Only running
 * and hiking have detail routes today; walks/rides land on the Activities
 * index since they have no per-activity page yet.
 */
function duplicateHref(sport: UploadSport, id: string): string {
  if (sport === "hiking") return `/hiking/${id}`;
  if (sport === "running") return `/running/${id}`;
  return "/activities";
}

function Spinner() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
