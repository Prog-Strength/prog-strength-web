/**
 * Chat-surface icon set. Extracted verbatim from the chat page so the
 * restyled presentational components can share them. Each is a small,
 * currentColor SVG so the calling surface controls the tint via text
 * color.
 */

export function MicIcon() {
  // Rounded mic body with a stand. 14px so the button stays visually
  // balanced against the Send button's text label height.
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
      <path d="M9 21h6" />
    </svg>
  );
}

export function PlusIcon() {
  // Used by the header's "New chat" pill. 12px so it sits naturally
  // next to the 12px text label without towering over it.
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function SendIcon() {
  // Paper-plane icon used inside the Send button on mobile (sm: and
  // above the button shows the "Send" text instead). 16px so the
  // glyph is large enough to be tappable on its own without a label.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </svg>
  );
}

export function PaperclipIcon() {
  // Standard paperclip, matching the mic icon's vocabulary (1.75 stroke,
  // rounded joins). 16px to sit a touch larger than the mic in the same
  // 44px button.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 8.5l-9.2 9.2a4 4 0 0 1-5.66-5.66l9.2-9.2a2.667 2.667 0 0 1 3.77 3.77l-9.2 9.2a1.333 1.333 0 0 1-1.89-1.89l8.49-8.49" />
    </svg>
  );
}

export function SpeakerIcon({ muted }: { muted: boolean }) {
  // Speaker + waves on (voice mode active) or speaker + slash on
  // (muted). Same outer body so the icon doesn't visually jump
  // between states.
  return (
    <svg
      viewBox="0 0 24 24"
      width={12}
      height={12}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M11 5L6 9H3v6h3l5 4z" />
      {muted ? (
        <>
          <path d="M17 9l5 6" />
          <path d="M22 9l-5 6" />
        </>
      ) : (
        <>
          <path d="M15.5 9a3.5 3.5 0 0 1 0 6" />
          <path d="M18.5 6a7 7 0 0 1 0 12" />
        </>
      )}
    </svg>
  );
}

export function DotsIcon() {
  // Three small dots — used inside the running-state pill alongside
  // the surrounding animate-pulse so the whole pill breathes while
  // a tool call is in flight.
  return (
    <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  );
}

export function XIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={10}
      height={10}
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function SearchIcon() {
  // Magnifying glass — the universal "search" glyph. Reused from the
  // sidebar's search entry to keep the icon vocabulary consistent.
  return (
    <svg
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={13}
      height={13}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}
