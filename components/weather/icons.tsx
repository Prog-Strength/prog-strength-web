/**
 * Shared weather glyphs — hand-rolled currentColor stroke SVGs in the chat
 * icon idiom (components/chat/icons.tsx). Deliberately no sky-blue sky or
 * sun-yellow sun: the palette reserves saturated color for the activity
 * disciplines, so callers tint these neutrals via text color
 * (`--foreground` / `--muted`).
 *
 * Cross-route rather than route-private (`app/(app)/dashboard/_components/`,
 * where it shipped): the activity-detail conditions beat is a second consumer
 * and can't reach into another route's `_components`.
 *
 * `icon` is an OpenWeather icon code ("01d", "10n", …). Only the numeric
 * prefix picks the glyph — day/night variants share a drawing, because a
 * moon glyph buys nothing on a card the user reads for temperature.
 */

export function WeatherIcon({ icon, className }: { icon: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {glyph(icon.slice(0, 2))}
    </svg>
  );
}

/** Shared cloud body, alone for the cloudy codes and raised for the
 *  rain/storm composites so the weather has room to fall under it. */
const CLOUD = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";
const CLOUD_RAISED = "M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24";

function glyph(prefix: string) {
  switch (prefix) {
    case "01": // clear — sun disc with rays
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </>
      );
    case "09": // shower rain / rain — cloud with drops
    case "10":
      return (
        <>
          <path d={CLOUD_RAISED} />
          <path d="M8 15v3M12 16v3M16 15v3" />
        </>
      );
    case "11": // thunderstorm — cloud with a bolt
      return (
        <>
          <path d={CLOUD_RAISED} />
          <path d="m13 12-3 5h4l-3 5" />
        </>
      );
    case "13": // snow — flake asterisk
      return <path d="M12 3v18M3 12h18M6.34 6.34l11.32 11.32M17.66 6.34 6.34 17.66" />;
    case "50": // mist / fog — layered lines
      return <path d="M4 8h16M3 12h18M5 16h14" />;
    default: // 02/03/04 (clouds) and anything the API grows later
      return <path d={CLOUD} />;
  }
}
