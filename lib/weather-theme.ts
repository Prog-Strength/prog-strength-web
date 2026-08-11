/**
 * One place that decides what a weather condition LOOKS like.
 *
 * An OpenWeather icon code ("01d", "10n", …) maps to a tone from the
 * `--weather-*` token family and to the motion its glyph carries. Both the tile
 * and the forecast panel read it, so a rainy hour is the same blue and the same
 * falling drops wherever it is drawn — and adding a condition family is one
 * entry here rather than a hunt through two components.
 *
 * Only the NUMERIC prefix is read; the d/n suffix is ignored, matching
 * `WeatherIcon`'s own rule that a moon glyph buys nothing on a card the user
 * reads for temperature.
 *
 * The tones are deliberately quiet. This is a dark, near-black dashboard whose
 * saturated color is spoken for by the activity disciplines, so a condition
 * tints a glyph and a soft wash behind it — it never colors a temperature
 * readout or floods a card. `tint` is 13%-alpha and is meant to be barely
 * perceptible until you compare two locations side by side.
 */

/** The condition families the tile distinguishes. */
export type WeatherKind = "clear" | "clouds" | "rain" | "storm" | "snow" | "fog";

export type WeatherTheme = {
  kind: WeatherKind;
  /** Solid tone for the glyph — a `--weather-*` token, never a raw hex. */
  tone: string;
  /** 13%-alpha companion for a wash behind the current conditions. */
  tint: string;
  /** A short human label, for the aria description of a decorative glyph. */
  label: string;
};

const THEMES: Record<WeatherKind, WeatherTheme> = {
  clear: {
    kind: "clear",
    tone: "var(--weather-clear)",
    tint: "var(--weather-clear-soft)",
    label: "clear",
  },
  clouds: {
    kind: "clouds",
    tone: "var(--weather-clouds)",
    tint: "var(--weather-clouds-soft)",
    label: "cloudy",
  },
  rain: {
    kind: "rain",
    tone: "var(--weather-rain)",
    tint: "var(--weather-rain-soft)",
    label: "rain",
  },
  storm: {
    kind: "storm",
    tone: "var(--weather-storm)",
    tint: "var(--weather-storm-soft)",
    label: "thunderstorms",
  },
  snow: {
    kind: "snow",
    tone: "var(--weather-snow)",
    tint: "var(--weather-snow-soft)",
    label: "snow",
  },
  fog: { kind: "fog", tone: "var(--weather-fog)", tint: "var(--weather-fog-soft)", label: "fog" },
};

/**
 * The condition family for an icon code. An unknown or empty code reads as
 * `clouds` — the neutral of the six, and what the glyph itself falls back to,
 * so a code the provider grows later is quiet rather than conspicuous.
 */
export function weatherKind(icon: string | undefined): WeatherKind {
  switch ((icon ?? "").slice(0, 2)) {
    case "01":
      return "clear";
    case "09":
    case "10":
      return "rain";
    case "11":
      return "storm";
    case "13":
      return "snow";
    case "50":
      return "fog";
    default:
      return "clouds";
  }
}

/** The full theme for an icon code. */
export function weatherTheme(icon: string | undefined): WeatherTheme {
  return THEMES[weatherKind(icon)];
}

/**
 * A vertical wash for the card behind current conditions — the tint at the top
 * fading to nothing well before the bottom, so the card still reads as a member
 * of the neutral grid rather than as a colored panel.
 */
export function weatherWash(icon: string | undefined): string {
  return `linear-gradient(160deg, ${weatherTheme(icon).tint} 0%, transparent 62%)`;
}
