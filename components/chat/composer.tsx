import type React from "react";
import { MicIcon, PaperclipIcon, SendIcon } from "./icons";

/**
 * The chat footer composer. Fully controlled and presentational — it
 * owns no state; the page lifts `input`, the staged image, the listening
 * flag, the file-input ref, and every handler. The drag/drop dropzone,
 * the capped banner, and the voice-forced-off note all stay on the page
 * (they wrap or sit above this component).
 */
export type ComposerProps = {
  input: string;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onAttachClick: () => void;
  onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingImage: { previewUrl: string; filename: string } | null;
  onDismissImage: () => void;
  speechSupported: boolean;
  listening: boolean;
  onMicDown: () => void;
  onMicUp: () => void;
  capped: boolean;
  cappedTooltip: string;
  streaming: boolean;
  loading: boolean;
  sessionId: string | null;
  placeholder: string;
};

export function Composer({
  input,
  onInputChange,
  onSend,
  onKeyDown,
  onAttachClick,
  onPaste,
  fileInputRef,
  onFileChange,
  pendingImage,
  onDismissImage,
  speechSupported,
  listening,
  onMicDown,
  onMicUp,
  capped,
  cappedTooltip,
  streaming,
  loading,
  sessionId,
  placeholder,
}: ComposerProps) {
  const sendDisabled =
    streaming ||
    loading ||
    !sessionId ||
    capped ||
    (input.trim().length === 0 && pendingImage === null);

  return (
    <>
      {pendingImage && (
        // Staged-image chip above the textarea: thumbnail + truncated
        // filename + dismiss. The thumbnail uses the chip's own object
        // URL (the scrollback bubble uses the base64 data URL instead).
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-1 pb-1">
          <div className="inline-flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URL preview; next/image can't optimize and would force a remote loader */}
            <img src={pendingImage.previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
            <span className="max-w-[180px] truncate text-xs text-[var(--muted)]">
              {pendingImage.filename}
            </span>
            <button
              type="button"
              onClick={onDismissImage}
              aria-label="Remove image"
              className="text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-2xl items-end gap-2">
        {speechSupported && (
          // Push-and-hold mic. mouseLeave is treated as "release"
          // too — without it a user who slides off the button
          // would never get an onMouseUp and the recognizer would
          // keep listening forever. Same shape for touch.
          <button
            type="button"
            onMouseDown={onMicDown}
            onMouseUp={onMicUp}
            onMouseLeave={onMicUp}
            onTouchStart={(e) => {
              e.preventDefault();
              onMicDown();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onMicUp();
            }}
            disabled={streaming || loading || !sessionId || capped}
            aria-disabled={capped}
            title={
              capped ? cappedTooltip : listening ? "Listening… release to stop" : "Hold to speak"
            }
            aria-pressed={listening}
            aria-label={listening ? "Stop voice input" : "Start voice input"}
            className={`flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-2xl border transition disabled:opacity-40 ${
              listening
                ? "animate-pulse border-[var(--danger)]/60 bg-[var(--danger)]/10 text-[var(--danger)]"
                : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            <MicIcon />
          </button>
        )}
        <button
          type="button"
          onClick={onAttachClick}
          disabled={streaming || loading || !sessionId}
          aria-label="Attach image"
          title="Attach image"
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] transition hover:text-[var(--foreground)] disabled:opacity-40"
        >
          <PaperclipIcon />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={onFileChange}
        />
        <textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          placeholder={placeholder}
          rows={1}
          // field-sizing-content lets the textarea grow with typed
          // content up to max-h, so the user can see what they wrote
          // before sending. Falls back to the rows=1 + min-h floor
          // on older browsers (pre-Chrome 123 / Safari 17.4 / FF 130).
          // max-h-[200px] caps growth so a runaway paste still scrolls
          // internally rather than swallowing the whole composer.
          className="min-h-[44px] max-h-[200px] flex-1 resize-none rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm placeholder:text-[var(--muted)] field-sizing-content focus:border-[var(--accent)] focus:outline-none"
          disabled={streaming || loading || !sessionId}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={sendDisabled}
          aria-disabled={capped}
          title={capped ? cappedTooltip : undefined}
          aria-label="Send message"
          // Mobile: 44×44 icon-only square that matches the mic and
          // paperclip's hit-target. Desktop (sm: and up): grows to
          // fit the "Send" text + the existing px-4 / py-2.5 padding.
          className="flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-sm font-medium text-[var(--accent-fg)] transition hover:opacity-90 disabled:opacity-40 sm:w-auto sm:px-4 sm:py-2.5"
        >
          {streaming ? (
            "…"
          ) : (
            <>
              <SendIcon />
              <span className="hidden sm:inline">Send</span>
            </>
          )}
        </button>
      </div>
    </>
  );
}
