/**
 * Splits one unified /activities page into the two buckets the mixed-type
 * surfaces render: strength sessions adapted onto the legacy `Workout`
 * shape (via `activityToWorkout`, so exercises / PR events / enrichment
 * arrive where the workout components expect them), and everything else
 * (runs, walks, rides) as the endurance `RunningSession` view.
 *
 * Shared by the Activities Overview, the Calendar, and the timeline's
 * YourWeekRail — the three surfaces that collapsed their workouts+runs
 * merges into ONE `listActivities` fetch in the stage-3 migration. Order
 * within each bucket preserves the API's most-recent-first order.
 */

import { activityToWorkout, type Activity, type RunningSession, type Workout } from "@/lib/api";

export type PartitionedActivities = {
  workouts: Workout[];
  sessions: RunningSession[];
};

export function partitionActivities(activities: Activity[]): PartitionedActivities {
  const workouts: Workout[] = [];
  const sessions: RunningSession[] = [];
  for (const a of activities) {
    if (a.activity_type === "strength_training") {
      workouts.push(activityToWorkout(a));
    } else {
      sessions.push(a);
    }
  }
  return { workouts, sessions };
}
