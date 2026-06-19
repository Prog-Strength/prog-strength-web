"use client";

import Body, { type ExtendedBodyPart, type Slug } from "react-muscle-highlighter";

import type { Exercise, Workout } from "@/lib/api";
import { setsByMuscleGroup } from "@/lib/muscle-set-distribution";
import { populatedCategories } from "@/lib/workout-recap";

/**
 * The workout's muscle work as a front + back anatomical silhouette, worked
 * regions shaded by set volume on the v0.4 lift intensity ramp. Replaces the
 * "What it trained" text strip: it *shows* what the strip *stated*, and keeps
 * the populated category counts as its caption so nothing the strip carried is
 * lost. Renders null on an uncategorizable session (no empty frame), exactly as
 * the strip dropped.
 *
 * Built on react-muscle-highlighter (the anatomy is intense to author and the
 * library models graded intensity as a first-class concept). Retoned to v0.4
 * entirely through props — no CSS polygon overrides. Page-scoped on purpose:
 * the shared WorkoutDetailsBody and the pre-v0.4 MuscleGroupRadarChart are
 * untouched.
 */

/**
 * Our 11 catalog `muscle_groups` → the library's `Slug` taxonomy. Where one of
 * our groups spans several anatomical regions (back, core), every mapped slug
 * inherits that group's intensity tier. A guard test asserts this covers every
 * key of `muscle-categories` MAP, so a future catalog muscle can't silently
 * fall off the figure.
 */
export const GROUP_TO_SLUGS: Record<string, Slug[]> = {
  chest: ["chest"],
  back: ["trapezius", "upper-back", "lower-back"],
  shoulders: ["deltoids"],
  biceps: ["biceps"],
  triceps: ["triceps"],
  forearms: ["forearm"],
  core: ["abs", "obliques"],
  quads: ["quadriceps"],
  hamstrings: ["hamstring"],
  glutes: ["gluteal"],
  calves: ["calves"],
};

// The v0.4 lift intensity ramp, dim → bright steel-blue. Literal hex mirroring
// the --discipline-lift-1..4 tokens (the library applies entries as SVG fill;
// literal hex keeps the rendered fills deterministic). intensity is 1-based:
// the library fills a part with colors[intensity - 1].
const RAMP = ["#39405a", "#5a6493", "#7d88c2", "#aab4dd"];

// Unworked silhouette — a desaturated near-black slate (≈ --surface-2), visible
// against the page without competing with the worked regions.
const DEFAULT_FILL = "#191c21";

const TIER_COUNT = 4;

// Every slug the library's front/back figures draw (the full `Slug` union as of
// v1.2.0). We paint all of them ourselves — worked regions on the ramp,
// everything else (untracked muscles, and the non-muscle head/hair/hands/feet
// the silhouette keeps) at DEFAULT_FILL — because the library's `defaultFill`
// prop has no runtime effect here: each asset part embeds a hardcoded
// `color: "#3f3f3f"` that wins over `defaultFill` in its fill chain. Passing an
// explicit `color` is the only way to retone the whole silhouette to a single
// near-black so unworked muscle and non-muscle regions read uniform.
// To regenerate after a library upgrade, list the asset slugs with:
//   grep -ho 'slug: "[^"]*"' node_modules/react-muscle-highlighter/dist/esm/assets/body{Front,Back}.js | sort -u
// (any new slug omitted here would otherwise show the library's internal gray).
const ALL_SLUGS: Slug[] = [
  "abs",
  "adductors",
  "ankles",
  "biceps",
  "calves",
  "chest",
  "deltoids",
  "feet",
  "forearm",
  "gluteal",
  "hair",
  "hamstring",
  "hands",
  "head",
  "knees",
  "lower-back",
  "neck",
  "obliques",
  "quadriceps",
  "tibialis",
  "trapezius",
  "triceps",
  "upper-back",
];

export function MuscleBodyMap({ workout, exercises }: { workout: Workout; exercises: Exercise[] }) {
  const { data, hasData } = setsByMuscleGroup(workout, exercises);
  if (!hasData) return null;

  // Tier each group relative to the session's busiest region, so the worked
  // regions of even a sparse, focused session reach the bright end and glow.
  const maxValue = data.reduce((max, d) => Math.max(max, d.value), 0);

  // Build a set of worked slugs and their tiers.
  const workedSlugs = new Map<string, number>();
  for (const { muscleGroup, value } of data) {
    const tier = Math.min(TIER_COUNT, Math.max(1, Math.ceil((value / maxValue) * TIER_COUNT)));
    for (const slug of GROUP_TO_SLUGS[muscleGroup] ?? []) {
      workedSlugs.set(slug, tier);
    }
  }

  // Worked slugs get an intensity tier (the library resolves those to
  // colors[intensity - 1]); every other slug is painted DEFAULT_FILL so the
  // whole silhouette reads as one near-black, with only the worked regions glowing.
  const parts: ExtendedBodyPart[] = ALL_SLUGS.map((slug) => {
    const tier = workedSlugs.get(slug);
    return tier !== undefined ? { slug, intensity: tier } : { slug, color: DEFAULT_FILL };
  });

  const categories = populatedCategories(workout, exercises);

  return (
    <figure className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-2">
        <Body
          side="front"
          data={parts}
          colors={RAMP}
          defaultFill={DEFAULT_FILL}
          defaultStroke="none"
          border="none"
          scale={0.7}
        />
        <Body
          side="back"
          data={parts}
          colors={RAMP}
          defaultFill={DEFAULT_FILL}
          defaultStroke="none"
          border="none"
          scale={0.7}
        />
      </div>
      <figcaption
        data-testid="muscle-body-map-caption"
        className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-[var(--muted)]"
      >
        {categories.map((m, i) => (
          <span key={m.category}>
            <span className="text-[var(--foreground)]">{m.category}</span>
            <span className="text-[var(--faint)]"> {m.value}</span>
            {i < categories.length - 1 && <span className="px-1.5 text-[var(--faint)]">·</span>}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
