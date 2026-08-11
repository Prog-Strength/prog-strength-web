/**
 * Shared weather glyphs — hand-rolled currentColor stroke SVGs in the chat
 * icon idiom (components/chat/icons.tsx). The DRAWINGS carry no color of their
 * own: callers tint them via text color, whether that is a neutral
 * (`--foreground` / `--muted`) on the activity-detail conditions beat or a
 * condition tone from the `--weather-*` family on the dashboard tile
 * (`lib/weather-theme.ts`). Keeping the tint outside the glyph is what lets one
 * drawing serve a colored weather surface and a neutral one at the same time.
 *
 * Cross-route rather than route-private (`app/(app)/dashboard/_components/`,
 * where it shipped): the activity-detail conditions beat is a second consumer
 * and can't reach into another route's `_components`.
 *
 * `icon` is an OpenWeather icon code ("01d", "10n", …). Only the numeric
 * prefix picks the glyph — day/night variants share a drawing, because a
 * moon glyph buys nothing on a card the user reads for temperature.
 *
 * `animated` moves the part of the drawing that actually moves in the sky —
 * rays turn, drops fall, a bolt flickers, fog sways — and leaves the rest
 * still. It is opt-in per call site so a dense list (an hourly strip with
 * twenty glyphs) can stay quiet while the one big current-conditions glyph
 * breathes. Every class it applies is switched off wholesale by the
 * reduced-motion block in globals.css.
 */

export function WeatherIcon({
  icon,
  className,
  animated = false,
}: {
  icon: string;
  className?: string;
  animated?: boolean;
}) {
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
      {glyph(icon.slice(0, 2), animated)}
    </svg>
  );
}

/** Shared cloud body, alone for the cloudy codes and raised for the
 *  rain/storm composites so the weather has room to fall under it. */
const CLOUD = "M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z";
const CLOUD_RAISED = "M4 14.9A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.24";

/** `animated ? cls : undefined` — keeps the static markup byte-identical. */
function anim(animated: boolean, cls: string): string | undefined {
  return animated ? cls : undefined;
}

function glyph(prefix: string, animated: boolean) {
  switch (prefix) {
    case "01": // clear — sun disc with rays
      return (
        <>
          <circle cx="12" cy="12" r="4" />
          {/* Only the rays turn; a spinning disc would just wobble. */}
          <path
            className={anim(animated, "weather-rays")}
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"
          />
        </>
      );
    case "09": // shower rain / rain — cloud with drops
    case "10":
      return (
        <>
          <path className={anim(animated, "weather-drift")} d={CLOUD_RAISED} />
          {/* Three drops on staggered delays, so they fall as rain rather than
              as one blinking row. */}
          <path className={anim(animated, "weather-fall")} d="M8 15v3" />
          <path
            className={anim(animated, "weather-fall")}
            style={animated ? { animationDelay: "0.55s" } : undefined}
            d="M12 16v3"
          />
          <path
            className={anim(animated, "weather-fall")}
            style={animated ? { animationDelay: "1.1s" } : undefined}
            d="M16 15v3"
          />
        </>
      );
    case "11": // thunderstorm — cloud with a bolt
      return (
        <>
          <path className={anim(animated, "weather-drift")} d={CLOUD_RAISED} />
          <path className={anim(animated, "weather-flash")} d="m13 12-3 5h4l-3 5" />
        </>
      );
    case "13": // snow — flake asterisk
      return (
        <path
          className={anim(animated, "weather-sway")}
          d="M12 3v18M3 12h18M6.34 6.34l11.32 11.32M17.66 6.34 6.34 17.66"
        />
      );
    case "50": // mist / fog — layered lines
      return <path className={anim(animated, "weather-sway")} d="M4 8h16M3 12h18M5 16h14" />;
    default: // 02/03/04 (clouds) and anything the API grows later
      return <path className={anim(animated, "weather-drift")} d={CLOUD} />;
  }
}
