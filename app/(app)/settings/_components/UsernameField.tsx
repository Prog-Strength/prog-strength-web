// app/(app)/settings/_components/UsernameField.tsx
"use client";

import { useEffect, useState } from "react";
import { checkUsernameAvailable } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { USERNAME_RE } from "./draft";
import { inputClass } from "./primitives";

const DEBOUNCE_MS = 400;

type Availability =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "available" }
  | { kind: "taken" }
  | { kind: "error"; message: string };

/**
 * The @-prefixed handle input. Owns the debounced availability probe and the
 * inline status line; reports its value up (lowercased) and whether it
 * currently blocks Save (checking / taken / charset-invalid while dirty).
 * It has no Save button — it gates the page's single save bar.
 */
export function UsernameField({
  value,
  original,
  disabled,
  onChange,
  onBlockedChange,
}: {
  value: string;
  original: string;
  disabled: boolean;
  onChange: (next: string) => void;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const [availability, setAvailability] = useState<Availability>({ kind: "idle" });

  const normalized = value.trim().toLowerCase();
  const charsetOk = USERNAME_RE.test(normalized);
  const dirty = normalized !== original.trim().toLowerCase();

  // Debounced probe: only for a dirty, charset-valid handle. Cleanup cancels
  // the in-flight timer/result so we don't fire a request per keystroke.
  useEffect(() => {
    if (!dirty || !charsetOk) {
      setAvailability({ kind: "idle" });
      return;
    }
    const token = getToken();
    if (!token) {
      setAvailability({ kind: "idle" });
      return;
    }
    setAvailability({ kind: "checking" });
    let cancelled = false;
    const handle = window.setTimeout(() => {
      checkUsernameAvailable(token, normalized)
        .then((free) => {
          if (cancelled) return;
          setAvailability(free ? { kind: "available" } : { kind: "taken" });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setAvailability({
            kind: "error",
            message: err instanceof Error ? err.message : "Couldn't check availability",
          });
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [normalized, dirty, charsetOk]);

  // Block Save while the handle is dirty and not known-good: charset-invalid,
  // mid-probe, or taken. (An idle/available/error-on-unchanged handle is fine.)
  const blocked =
    dirty && (!charsetOk || availability.kind === "checking" || availability.kind === "taken");
  useEffect(() => {
    onBlockedChange(blocked);
  }, [blocked, onBlockedChange]);

  const showCharsetHint = dirty && value.trim() !== "" && !charsetOk;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm text-[var(--muted)]">@</span>
        <input
          id="settings-username"
          type="text"
          aria-label="Username"
          value={value}
          maxLength={30}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value.toLowerCase())}
          className={`${inputClass} min-w-0 flex-1`}
        />
      </div>
      {showCharsetHint ? (
        <p className="text-xs text-[var(--danger)]">
          3–30 characters: start with a letter, then lowercase letters, numbers, or underscores.
        </p>
      ) : availability.kind === "checking" ? (
        <p className="text-xs text-[var(--muted)]">Checking availability…</p>
      ) : availability.kind === "available" ? (
        <p className="text-xs text-[var(--success)]">@{normalized} is available.</p>
      ) : availability.kind === "taken" ? (
        <p className="text-xs text-[var(--danger)]">@{normalized} is taken.</p>
      ) : availability.kind === "error" ? (
        <p className="text-xs text-[var(--muted)]">{availability.message}</p>
      ) : null}
    </div>
  );
}
