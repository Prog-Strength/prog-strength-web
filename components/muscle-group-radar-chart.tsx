"use client";

import { useMemo } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { Exercise, Workout } from "@/lib/api";
import { setsByCategory } from "@/lib/muscle-set-distribution";

/**
 * The Body Parts sibling to the time-lifting view — a six-axis muscle-
 * group distribution where each axis is the count of sets that touched
 * that category over the active window. Compound lifts credit every
 * category they hit, so a balanced program reads as a roughly even
 * hexagon and a lopsided one shows the gaps at a glance.
 *
 * Purely presentational. The workouts array and the exercise catalog
 * are passed in by the page so a single fetch hydrates both this chart
 * and the list below; set-count only, so there's no unit to convert.
 */

const CHART_HEIGHT = 200;

export function MuscleGroupRadarChart({
  workouts,
  exercises,
}: {
  // `null` while the parent is still loading. Empty array = no
  // workouts in the window (rendered as an empty-state card).
  workouts: Workout[] | null;
  // The shared exercise catalog, used to map each WorkoutExercise's
  // exercise_id slug to its muscle groups.
  exercises: Exercise[];
}) {
  const { data, hasData } = useMemo(
    () => setsByCategory(workouts ?? [], exercises),
    [workouts, exercises],
  );

  return (
    <div className="mt-3" style={{ height: CHART_HEIGHT }}>
      {workouts === null ? (
        <div className="flex h-full items-center justify-center text-xs text-[var(--muted)]">
          Loading…
        </div>
      ) : !hasData ? (
        <div className="flex h-full items-center justify-center rounded-md border border-[var(--border)] bg-[var(--background)] text-xs text-[var(--muted)]">
          Workouts in this window don&apos;t have categorizable muscle groups.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data}>
            <PolarGrid stroke="#27272a" />
            <PolarAngleAxis dataKey="category" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
            <PolarRadiusAxis stroke="#a1a1aa" tick={{ fill: "#a1a1aa", fontSize: 11 }} />
            <Radar dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.32} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#18181b",
                border: "1px solid #3f3f46",
                borderRadius: "0.375rem",
                padding: "6px 10px",
                fontSize: "12px",
              }}
              wrapperStyle={{ outline: "none" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
