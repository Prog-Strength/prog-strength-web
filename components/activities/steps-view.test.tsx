/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// --- module mocks ----------------------------------------------------------

const replaceMock = vi.hoisted(() => vi.fn());
const getTokenMock = vi.hoisted(() => vi.fn(() => "tok"));
const clearTokenMock = vi.hoisted(() => vi.fn());

const listStepsMock = vi.hoisted(() => vi.fn());
const getStepsGoalMock = vi.hoisted(() => vi.fn());
const putStepsGoalMock = vi.hoisted(() => vi.fn());
const upsertStepsMock = vi.hoisted(() => vi.fn());
const deleteStepsMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock("@/lib/auth", () => ({
  getToken: getTokenMock,
  clearToken: clearTokenMock,
}));

vi.mock("@/lib/api", () => ({
  listSteps: listStepsMock,
  getStepsGoal: getStepsGoalMock,
  putStepsGoal: putStepsGoalMock,
  upsertStepsForDate: upsertStepsMock,
  deleteStepsForDate: deleteStepsMock,
}));

// Recharts mocked to simple divs so the chart renders in jsdom and the
// goal ReferenceLine becomes a testable marker via its label value.
vi.mock("recharts", () => {
  const passthrough = (name: string) => {
    function Passthrough({ children }: { children?: React.ReactNode }) {
      return <div data-recharts={name}>{children}</div>;
    }
    return Passthrough;
  };
  const stub = (name: string) => {
    function Stub() {
      return <div data-recharts={name} />;
    }
    return Stub;
  };
  function ResponsiveContainer({ children }: { children: React.ReactNode }) {
    return <div>{children}</div>;
  }
  function ReferenceLine(props: { label?: { value?: string } }) {
    return (
      <div data-recharts="ReferenceLine" data-testid="goal-reference-line">
        {props.label?.value ?? ""}
      </div>
    );
  }
  return {
    ResponsiveContainer,
    BarChart: passthrough("BarChart"),
    Bar: passthrough("Bar"),
    Cell: (props: { fill?: string }) => <div data-recharts="Cell" data-fill={props.fill} />,
    CartesianGrid: stub("CartesianGrid"),
    XAxis: stub("XAxis"),
    YAxis: stub("YAxis"),
    Tooltip: stub("Tooltip"),
    ReferenceLine,
  };
});

import { StepsView } from "./steps-view";

// --- helpers ---------------------------------------------------------------

function entry(date: string, steps: number) {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

beforeEach(() => {
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("tok");
  getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
  // Default: range fetch + first keyset page both return the same set.
  listStepsMock.mockResolvedValue({
    steps: [entry("2026-06-10", 8000), entry("2026-06-11", 12000)],
    next_before: null,
  });
});

describe("StepsView — stat tiles", () => {
  it("renders an Avg daily steps tile derived from the range entries", async () => {
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText("Avg daily steps")).toBeInTheDocument());
    // (8000 + 12000) / 2 = 10,000
    expect(screen.getByText("10,000")).toBeInTheDocument();
    // Total steps tile
    expect(screen.getByText("Total steps")).toBeInTheDocument();
    expect(screen.getByText("20,000")).toBeInTheDocument();
  });
});

describe("StepsView — goal reference line", () => {
  it("omits the goal ReferenceLine when the goal is 0", async () => {
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText("Avg daily steps")).toBeInTheDocument());
    expect(screen.queryByTestId("goal-reference-line")).not.toBeInTheDocument();
  });

  it("renders the goal ReferenceLine with its label when goal > 0", async () => {
    getStepsGoalMock.mockResolvedValue({
      goal: 10000,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("goal-reference-line")).toBeInTheDocument());
    expect(screen.getByTestId("goal-reference-line")).toHaveTextContent("Goal 10,000");
  });
});

describe("StepsView — over/under-goal bars", () => {
  it("tones over-goal and under-goal days with distinct fills", async () => {
    getStepsGoalMock.mockResolvedValue({
      goal: 10000,
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
    });
    listStepsMock.mockResolvedValue({
      steps: [entry("2026-06-10", 12000), entry("2026-06-11", 8000)],
      next_before: null,
    });

    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText("Avg daily steps")).toBeInTheDocument());

    const cells = Array.from(document.querySelectorAll('[data-recharts="Cell"]'));
    expect(cells).toHaveLength(2);
    const fills = cells.map((c) => c.getAttribute("data-fill"));
    // Two distinct tones: success for the over-goal day, muted for under.
    expect(new Set(fills).size).toBe(2);
    expect(fills).toContain("#86b39f"); // CHART_STEPS_MET (over goal)
    expect(fills).toContain("#5b6168"); // CHART_STEPS_UNDER (under goal)
  });

  it("uses one calm periwinkle tone for every bar when no goal is set", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
    listStepsMock.mockResolvedValue({
      steps: [entry("2026-06-10", 12000), entry("2026-06-11", 8000)],
      next_before: null,
    });

    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText("Avg daily steps")).toBeInTheDocument());

    const cells = Array.from(document.querySelectorAll('[data-recharts="Cell"]'));
    expect(cells).toHaveLength(2);
    const fills = cells.map((c) => c.getAttribute("data-fill"));
    expect(new Set(fills)).toEqual(new Set(["#9aa6d6"])); // CHART_LIFT_LINE
  });
});

describe("StepsView — keyset pagination", () => {
  it("shows Load more when next_before is set and fetches with before on click", async () => {
    // Range fetch (call 1) + first keyset page (call 2) both resolve via
    // the default mock, but the first keyset page should carry a cursor.
    listStepsMock.mockImplementation((_token: string, opts: { before?: string } = {}) => {
      if (opts.before) {
        return Promise.resolve({ steps: [entry("2026-06-01", 5000)], next_before: null });
      }
      return Promise.resolve({
        steps: [entry("2026-06-10", 8000), entry("2026-06-11", 12000)],
        next_before: "2026-06-10",
      });
    });

    render(<StepsView days={30} />);

    const loadMore = await screen.findByRole("button", { name: /load more/i });
    expect(loadMore).toBeInTheDocument();

    fireEvent.click(loadMore);

    await waitFor(() =>
      expect(listStepsMock).toHaveBeenCalledWith("tok", { limit: 25, before: "2026-06-10" }),
    );
  });
});
