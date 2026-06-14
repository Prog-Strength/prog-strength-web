import { describe, expect, it } from "vitest";
import { filterExercises } from "@/components/live-workout/exercise-search";
import type { Exercise } from "@/lib/api";

const catalog: Exercise[] = [
  {
    id: "bench-press",
    name: "Barbell Bench Press",
    muscle_groups: ["chest"],
    equipment: ["barbell"],
  },
  { id: "db-row", name: "Dumbbell Row", muscle_groups: ["back"], equipment: ["dumbbell"] },
  { id: "squat", name: "Back Squat", muscle_groups: ["quads", "glutes"], equipment: ["barbell"] },
];

describe("filterExercises", () => {
  it("returns nothing for an empty/blank query", () => {
    expect(filterExercises(catalog, "")).toEqual([]);
    expect(filterExercises(catalog, "   ")).toEqual([]);
  });

  it("matches by name case-insensitively", () => {
    const r = filterExercises(catalog, "bench");
    expect(r.map((e) => e.id)).toEqual(["bench-press"]);
    expect(filterExercises(catalog, "BENCH").map((e) => e.id)).toEqual(["bench-press"]);
  });

  it("matches by muscle group", () => {
    expect(
      filterExercises(catalog, "back")
        .map((e) => e.id)
        .sort(),
    ).toEqual(["db-row", "squat"].sort());
  });

  it("matches by equipment (results name-sorted)", () => {
    expect(filterExercises(catalog, "barbell").map((e) => e.id)).toEqual(["squat", "bench-press"]);
  });

  it("sorts results alphabetically by name", () => {
    const r = filterExercises(catalog, "barbell");
    expect(r.map((e) => e.name)).toEqual(["Back Squat", "Barbell Bench Press"]);
  });
});
