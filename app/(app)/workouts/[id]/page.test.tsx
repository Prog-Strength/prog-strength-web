/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { Exercise, PlannedWorkout, Workout, WorkoutExercise, WorkoutSet } from "@/lib/api";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth", () => ({
  getToken: () => "test-token",
  clearToken: vi.fn(),
}));

// The viewer's profile — the detail page reads it to gate owner affordances
// (the photo strip). The fixtures carry no user_id, so the page falls back to
// treating the viewer as owner on their own session either way.
vi.mock("@/lib/profile-context", () => ({
  useProfile: () => ({ profile: { id: "user-1", display_name: "Sam" } }),
}));

// The photo strip is stubbed to a marker; its own behavior is covered by
// PhotoStrip.test.tsx. This keeps the detail-page test focused on layout/wiring.
vi.mock("@/components/activity-detail/PhotoStrip", () => ({
  PhotoStrip: () => <div data-testid="photo-strip" />,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: replaceMock }),
  useParams: () => ({ id: "wkt-canonical" }),
}));

// Plan-linkage banner — stubbed to a recognizable marker so its presence /
// absence is asserted deterministically without depending on its internals.
vi.mock("@/components/completes-plan-banner", () => ({
  CompletesPlanBanner: () => <div data-testid="plan-banner" />,
}));

// The edit modals are stubbed to markers; we assert the preserved handlers
// open the right one with the right mode, not the modals' own rendering.
vi.mock("@/components/workout-details-edit-modal", () => ({
  WorkoutDetailsEditModal: () => <div data-testid="details-modal" />,
}));

vi.mock("@/components/exercise-edit-modal", async (orig) => ({
  ...(await orig<typeof import("@/components/exercise-edit-modal")>()),
  ExerciseEditModal: ({ mode }: { mode: "edit" | "add" }) => (
    <div data-testid="exercise-modal" data-mode={mode} />
  ),
}));

vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getWorkout: vi.fn(),
  listExercises: vi.fn(),
  getPlannedWorkoutBySession: vi.fn(async () => null),
  deleteWorkout: vi.fn(async () => {}),
}));

// Recharts renders nothing useful in jsdom; the HeartRateEffortCard's chart is
// stubbed so the card's tiles/title still assert cleanly.
vi.mock("recharts", () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  const noop = () => null;
  return {
    ResponsiveContainer: passthrough,
    LineChart: passthrough,
    Line: noop,
    CartesianGrid: noop,
    XAxis: noop,
    YAxis: noop,
    Tooltip: noop,
    ReferenceLine: noop,
  };
});

import { deleteWorkout, getPlannedWorkoutBySession, getWorkout, listExercises } from "@/lib/api";
import WorkoutDetailPage from "./page";

// --- fixtures --------------------------------------------------------------

const CATALOG: Exercise[] = [
  {
    id: "bench",
    name: "Barbell Bench Press",
    muscle_groups: ["chest", "triceps"],
    equipment: ["barbell"],
  },
  {
    id: "row",
    name: "Barbell Bent Over Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["barbell"],
  },
  {
    id: "incline-db",
    name: "Incline Dumbbell Bench Press",
    muscle_groups: ["chest", "shoulders"],
    equipment: ["dumbbell"],
    description: "Record weight per dumbbell, not the combined pair.",
  },
  {
    id: "tripod-row",
    name: "Dumbbell Tripod Row",
    muscle_groups: ["back", "biceps"],
    equipment: ["dumbbell"],
  },
  {
    id: "ohp",
    name: "Seated Dumbbell Shoulder Press",
    muscle_groups: ["shoulders"],
    equipment: ["dumbbell"],
  },
  { id: "pulldown", name: "Lat Pulldown", muscle_groups: ["back"], equipment: ["cable"] },
  {
    id: "squat",
    name: "Barbell Back Squat",
    muscle_groups: ["quads", "glutes"],
    equipment: ["barbell"],
  },
  { id: "leg-ext", name: "Leg Extension", muscle_groups: ["quads"], equipment: ["machine"] },
  { id: "leg-curl", name: "Lying Leg Curl", muscle_groups: ["hamstrings"], equipment: ["machine"] },
  { id: "calf", name: "Standing Calf Raise", muscle_groups: ["calves"], equipment: ["machine"] },
];

const set = (reps: number, weight: number, unit: WorkoutSet["unit"] = "lb"): WorkoutSet => ({
  reps,
  weight,
  unit,
});

const ex = (
  exercise_id: string,
  order: number,
  sets: WorkoutSet[],
  superset_group: number | null = null,
): WorkoutExercise => ({ exercise_id, order, superset_group, sets });

const CANONICAL: Workout = {
  id: "wkt-canonical",
  user_id: "u-1",
  name: "Week 2 Workout 1 - Chest & Back",
  performed_at: "2026-05-11T17:30:00Z",
  ended_at: "2026-05-11T18:50:00Z",
  notes: "Great workout! I hit 305 lbs for 2 reps on bench press. Nice!!!",
  created_at: "2026-05-11T18:50:00Z",
  updated_at: "2026-05-11T18:50:00Z",
  exercises: [
    ex("bench", 1, [set(10, 185), set(10, 225), set(6, 275), set(2, 305)]),
    ex("row", 2, [set(10, 135), set(8, 175), set(5, 195), set(3, 205)]),
    ex("incline-db", 3, [set(10, 70), set(9, 80), set(7, 90), set(7, 90)]),
    ex("tripod-row", 4, [set(10, 65), set(8, 75), set(6, 80), set(6, 80)]),
    ex("ohp", 5, [set(12, 45), set(10, 55), set(8, 60), set(8, 60)], 1),
    ex("pulldown", 6, [set(12, 130), set(10, 150), set(10, 150), set(8, 170), set(8, 170)], 1),
  ],
  personal_records_set: [
    pr("pr-bench", "bench", 305, 2, 245),
    pr("pr-row", "row", 205, 3, 185),
    pr("pr-incline", "incline-db", 90, 7, 85),
    pr("pr-tripod", "tripod-row", 80, 6, null),
  ],
};

const PLAIN: Workout = {
  id: "wkt-plain",
  user_id: "u-1",
  name: "Workout - May 14",
  performed_at: "2026-05-14T18:00:00Z",
  ended_at: null,
  notes: "",
  created_at: "2026-05-14T18:40:00Z",
  updated_at: "2026-05-14T18:40:00Z",
  exercises: [
    ex("squat", 1, [set(5, 225), set(5, 225), set(5, 225)]),
    ex("leg-ext", 2, [set(12, 110), set(12, 110), set(12, 110)], 1),
    ex("leg-curl", 3, [set(12, 90), set(12, 90), set(12, 90)], 1),
    ex("calf", 4, [set(15, 180), set(15, 180), set(15, 180)]),
  ],
  personal_records_set: [],
};

// A workout enriched with a Garmin TCX: carries activity_id + enrichment
// (with HR trackpoints, as on the detail load).
const ENRICHED: Workout = {
  ...CANONICAL,
  id: "wkt-canonical",
  activity_id: "act-123",
  enrichment: {
    source_activity_id: "strength-1",
    start_time: "2026-05-11T17:30:00Z",
    duration_seconds: 4800,
    avg_heart_rate_bpm: 142,
    max_heart_rate_bpm: 168,
    total_calories: 512,
    trackpoints: [
      { sequence: 0, elapsed_seconds: 0, heart_rate_bpm: 110 },
      { sequence: 1, elapsed_seconds: 60, heart_rate_bpm: 150 },
    ],
  },
};

// An empty workout created from a TCX before any exercise is added.
const EMPTY_FROM_TCX: Workout = {
  id: "wkt-canonical",
  user_id: "u-1",
  name: "Workout - May 11",
  performed_at: "2026-05-11T17:30:00Z",
  ended_at: "2026-05-11T18:50:00Z",
  notes: "",
  created_at: "2026-05-11T18:50:00Z",
  updated_at: "2026-05-11T18:50:00Z",
  exercises: [],
  personal_records_set: [],
  activity_id: "act-123",
  enrichment: {
    source_activity_id: "strength-1",
    start_time: "2026-05-11T17:30:00Z",
    duration_seconds: 4800,
    avg_heart_rate_bpm: 142,
    max_heart_rate_bpm: 168,
    total_calories: 512,
    trackpoints: [{ sequence: 0, elapsed_seconds: 0, heart_rate_bpm: 110 }],
  },
};

function pr(
  id: string,
  exercise_id: string,
  weight: number,
  reps: number,
  previous_weight: number | null,
) {
  return {
    id,
    exercise_id,
    workout_id: "w",
    weight,
    reps,
    unit: "lb" as const,
    previous_weight,
    previous_reps: previous_weight === null ? null : 3,
    previous_unit: previous_weight === null ? null : ("lb" as const),
    achieved_at: "2026-05-11T18:00:00Z",
  };
}

beforeEach(() => {
  vi.mocked(listExercises).mockResolvedValue(CATALOG);
  vi.mocked(getPlannedWorkoutBySession).mockResolvedValue(null);
  vi.mocked(getWorkout).mockResolvedValue(CANONICAL);
  replaceMock.mockClear();
  vi.mocked(deleteWorkout).mockClear();
});

describe("WorkoutDetailPage — canonical four-PR session", () => {
  it("leads with the top-PR headline and a --warning PR subhead", async () => {
    render(<WorkoutDetailPage />);
    expect(
      await screen.findByText("Four PRs, topped by 305 lb × 2 on Bench Press"),
    ).toBeInTheDocument();
    const subhead = screen.getByText(
      "4 new personal records — including 305 lb × 2 and 205 lb × 3.",
    );
    expect(subhead.className).toContain("text-[var(--warning)]");
  });

  it("renders the reflection as prose and a PRs stat tile", async () => {
    render(<WorkoutDetailPage />);
    expect(await screen.findByText(/I hit 305 lbs for 2 reps on bench press/)).toBeInTheDocument();
    expect(screen.getByText("PRs")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
    expect(screen.getByText("1h 20m")).toBeInTheDocument();
  });

  it("shows each exercise's top set and collapses the finishing superset", async () => {
    render(<WorkoutDetailPage />);
    expect(await screen.findByText("4 × · top 305 lb")).toBeInTheDocument();
    // dumbbell lift carries the per-dumbbell clarifier
    expect(screen.getByText("4 × · top 90 lb per dumbbell")).toBeInTheDocument();
    // the ohp ↔ pulldown superset reads as one block with a single tag
    expect(screen.getAllByText("superset")).toHaveLength(1);
  });

  it("renders the muscle body-map and drops the old text strip", async () => {
    const { container } = render(<WorkoutDetailPage />);
    await screen.findByText("Four PRs, topped by 305 lb × 2 on Bench Press");
    // the old "What it trained" strip heading is gone
    expect(screen.queryByText("What it trained")).not.toBeInTheDocument();
    // the body-map rendered anatomical paths (chest/back hit by this session)
    expect(container.querySelector('path[id="chest"]')).not.toBeNull();
    // its caption carries the category counts the strip used to show
    const caption = screen.getByTestId("muscle-body-map-caption");
    expect(caption).toHaveTextContent("Back");
  });

  it("preserves the edit affordances and wires them to the right modals", async () => {
    render(<WorkoutDetailPage />);
    fireEvent.click(await screen.findByText("Edit details"));
    expect(screen.getByTestId("details-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ Add exercise"));
    expect(screen.getByTestId("exercise-modal").dataset.mode).toBe("add");
  });

  it("opens the exercise editor in edit mode from a per-exercise pencil", async () => {
    render(<WorkoutDetailPage />);
    const pencils = await screen.findAllByLabelText("Edit exercise");
    fireEvent.click(pencils[0]);
    expect(screen.getByTestId("exercise-modal").dataset.mode).toBe("edit");
  });

  it("deletes via the preserved handler and redirects", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<WorkoutDetailPage />);
    fireEvent.click(await screen.findByText("Delete"));
    await waitFor(() => expect(deleteWorkout).toHaveBeenCalledWith("test-token", "wkt-canonical"));
    expect(replaceMock).toHaveBeenCalledWith("/activities?view=workouts");
    confirmSpy.mockRestore();
  });

  it("renders the plan-linkage banner when the session fulfilled a plan", async () => {
    vi.mocked(getPlannedWorkoutBySession).mockResolvedValue({ id: "p1" } as PlannedWorkout);
    render(<WorkoutDetailPage />);
    expect(await screen.findByTestId("plan-banner")).toBeInTheDocument();
  });
});

describe("WorkoutDetailPage — zero-PR / no-note / open session", () => {
  beforeEach(() => {
    vi.mocked(getWorkout).mockResolvedValue(PLAIN);
  });

  it("falls back to the date headline with no PR subhead", async () => {
    render(<WorkoutDetailPage />);
    // auto-generated name → date headline
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("May 14, 2026");
    expect(screen.queryByText(/new personal record/)).not.toBeInTheDocument();
  });

  it("shows the empty-reflection placeholder and drops Duration + PRs tiles", async () => {
    render(<WorkoutDetailPage />);
    expect(await screen.findByText("No reflection on this session.")).toBeInTheDocument();
    expect(screen.queryByText("Duration")).not.toBeInTheDocument();
    expect(screen.queryByText("PRs")).not.toBeInTheDocument();
  });

  it("shows only the worked categories in the body-map caption", async () => {
    render(<WorkoutDetailPage />);
    const caption = await screen.findByTestId("muscle-body-map-caption");
    expect(within(caption).getByText("Legs")).toBeInTheDocument();
    expect(within(caption).queryByText("Chest")).not.toBeInTheDocument();
  });

  it("reads a flat scheme's first set as the top set", async () => {
    render(<WorkoutDetailPage />);
    // squat 3×5 @ 225 — flat, so the first equal-weight set is the top set
    expect(await screen.findByText("3 × · top 225 lb")).toBeInTheDocument();
  });

  it("does not render the plan banner for an unplanned session", async () => {
    render(<WorkoutDetailPage />);
    await screen.findByText("No reflection on this session.");
    expect(screen.queryByTestId("plan-banner")).not.toBeInTheDocument();
  });
});

describe("WorkoutDetailPage — uncategorizable session drops the map", () => {
  const UNCATEGORIZED: Workout = {
    ...PLAIN,
    id: "wkt-uncat",
    exercises: [ex("mystery-lift", 1, [set(5, 100), set(5, 100)])],
  };

  beforeEach(() => {
    // catalog entry whose muscle group maps to nothing
    vi.mocked(listExercises).mockResolvedValue([
      { id: "mystery-lift", name: "Mystery Lift", muscle_groups: ["unknown-thing"], equipment: [] },
    ]);
    vi.mocked(getWorkout).mockResolvedValue(UNCATEGORIZED);
  });

  it("renders no body-map and no caption when nothing maps", async () => {
    const { container } = render(<WorkoutDetailPage />);
    await screen.findByText("Mystery Lift");
    expect(container.querySelector("path[id]")).toBeNull();
    expect(screen.queryByTestId("muscle-body-map-caption")).not.toBeInTheDocument();
    // the stat line still renders (full width)
    expect(screen.getByText("Volume")).toBeInTheDocument();
  });
});

describe("WorkoutDetailPage — Garmin TCX enrichment", () => {
  it("renders the Heart rate & effort card and the ♥ indicator when enrichment is present", async () => {
    vi.mocked(getWorkout).mockResolvedValue(ENRICHED);
    render(<WorkoutDetailPage />);
    expect(await screen.findByText("Heart rate & effort")).toBeInTheDocument();
    // The four stat tiles carry the enrichment values.
    expect(screen.getByText("142")).toBeInTheDocument(); // Avg HR
    expect(screen.getByText("168")).toBeInTheDocument(); // Max HR
    expect(screen.getByText("512")).toBeInTheDocument(); // Calories
    expect(screen.getByText("Active time")).toBeInTheDocument();
    // The subtitle gains the quiet "from Garmin" indicator.
    expect(screen.getByText(/from Garmin/)).toBeInTheDocument();
    // The header action flips to Detach.
    expect(screen.getByText("Detach TCX")).toBeInTheDocument();
  });

  it("omits the card and shows Attach TCX when there is no enrichment", async () => {
    vi.mocked(getWorkout).mockResolvedValue(CANONICAL);
    render(<WorkoutDetailPage />);
    await screen.findByText("Four PRs, topped by 305 lb × 2 on Bench Press");
    expect(screen.queryByText("Heart rate & effort")).not.toBeInTheDocument();
    expect(screen.queryByText(/from Garmin/)).not.toBeInTheDocument();
    expect(screen.getByText("Attach TCX")).toBeInTheDocument();
  });

  it("renders the empty-exercise state with the card for a workout created from a TCX", async () => {
    vi.mocked(getWorkout).mockResolvedValue(EMPTY_FROM_TCX);
    render(<WorkoutDetailPage />);
    // The card renders even with zero exercises.
    expect(await screen.findByText("Heart rate & effort")).toBeInTheDocument();
    // The empty-exercise affordance is present and the Exercises tile reads 0.
    expect(screen.getByText("+ Add exercise")).toBeInTheDocument();
    const exercisesTile = screen.getByText("Exercises").closest("div");
    expect(exercisesTile).toHaveTextContent("0");
  });
});
