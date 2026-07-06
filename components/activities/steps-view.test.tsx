/// <reference types="vitest/globals" />

import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";

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

// Recharts mocked to simple divs so the chart renders in jsdom. Bars expose
// their dataKey + fill so the goal-relative base/crest split is testable, and
// the goal ReferenceLine becomes a testable marker via its label value.
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
  function Bar({
    children,
    dataKey,
    fill,
  }: {
    children?: React.ReactNode;
    dataKey?: string;
    fill?: string;
  }) {
    return (
      <div data-recharts="Bar" data-datakey={dataKey} data-fill={fill}>
        {children}
      </div>
    );
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
    Bar,
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

function isoLocal(d: Date): string {
  const y = String(d.getFullYear()).padStart(4, "0");
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Dates relative to "today" so the entries always land inside the 30-day
// window regardless of the machine clock the test runs on.
function daysAgo(n: number): string {
  const t = new Date();
  return isoLocal(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n));
}

function entry(date: string, steps: number) {
  return { id: date, date, steps, created_at: date, updated_at: date };
}

// Pinned calendar days in the same Mon-start week (Jun 29 – Jul 5) so the
// accordion's default-expanded week always contains both rows regardless of
// when CI runs. "Today" is pinned to Jul 5 in beforeEach so the 30-day range
// window includes them.
const TODAY = "2026-07-05";
const YESTERDAY = "2026-07-04";

function bars() {
  return Array.from(document.querySelectorAll('[data-recharts="Bar"]')).map((b) => ({
    key: b.getAttribute("data-datakey"),
    fill: b.getAttribute("data-fill"),
  }));
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date(2026, 6, 5, 12, 0, 0));
  vi.clearAllMocks();
  getTokenMock.mockReturnValue("tok");
  getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
  // Default: range fetch + first keyset page both return the same set. avg of
  // 8000 + 12000 = 10,000; row pcts (against a 10k goal) are 80% and 120%.
  listStepsMock.mockResolvedValue({
    steps: [entry(YESTERDAY, 8000), entry(TODAY, 12000)],
    next_before: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("StepsView — hero ring", () => {
  it("centers the period average in the ring", async () => {
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("hero-average")).toBeInTheDocument());
    // (8000 + 12000) / 2 = 10,000
    expect(screen.getByTestId("hero-average")).toHaveTextContent("10,000");
  });

  it("fills in the accent and clears to success once at/over goal", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 10000, created_at: "x", updated_at: "x" });
    listStepsMock.mockResolvedValue({
      steps: [entry(YESTERDAY, 12000), entry(TODAY, 12000)], // avg 12,000 ⇒ 120%
      next_before: null,
    });
    render(<StepsView days={30} />);
    const caption = await screen.findByText(/120% of 10,000 goal/);
    expect(caption).toHaveStyle({ color: "var(--success)" });
  });

  it("keeps the fill in the accent (not success) while under goal", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 10000, created_at: "x", updated_at: "x" });
    listStepsMock.mockResolvedValue({
      steps: [entry(YESTERDAY, 8000), entry(TODAY, 8000)], // avg 8,000 ⇒ 80%
      next_before: null,
    });
    render(<StepsView days={30} />);
    const caption = await screen.findByText(/80% of 10,000 goal/);
    expect(caption).toHaveStyle({ color: "var(--accent)" });
  });

  it("renders a neutral ring with no NaN% when no goal is set", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText(/no goal set/)).toBeInTheDocument());
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    // Days-hit reads as a dash without a goal.
    const daysHit = screen.getByText("Days hit").parentElement;
    expect(daysHit).toHaveTextContent("—");
  });

  it("shows the EmptyRing start state when there are no entries at all", async () => {
    listStepsMock.mockResolvedValue({ steps: [], next_before: null });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByText(/your ring fills as you log/)).toBeInTheDocument());
  });
});

describe("StepsView — goal-relative bars", () => {
  it("renders a muted base + a success crest against the goal line when a goal is set", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 10000, created_at: "x", updated_at: "x" });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("goal-reference-line")).toBeInTheDocument());
    expect(screen.getByTestId("goal-reference-line")).toHaveTextContent("Goal 10,000");

    const rendered = bars();
    const base = rendered.find((b) => b.key === "base");
    const crest = rendered.find((b) => b.key === "crest");
    expect(base?.fill).toBe("#5b6168"); // CHART_STEPS_UNDER
    expect(crest?.fill).toBe("#86b39f"); // CHART_STEPS_MET
    // No single all-steps bar in goal mode.
    expect(rendered.find((b) => b.key === "steps")).toBeUndefined();
  });

  it("uses one calm accent bar and omits the goal line when no goal is set", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("hero-average")).toBeInTheDocument());

    const rendered = bars();
    expect(rendered).toHaveLength(1);
    expect(rendered[0].key).toBe("steps");
    expect(rendered[0].fill).toBe("#9aa6d6"); // CHART_LIFT_LINE
    expect(screen.queryByTestId("goal-reference-line")).not.toBeInTheDocument();
  });
});

describe("StepsView — ring-row log", () => {
  it("shows a per-day goal-% on each row in the expanded week", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 10000, created_at: "x", updated_at: "x" });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("hero-average")).toBeInTheDocument());
    // Row percents: 8000 ⇒ 80%, 12000 ⇒ 120% (current week expanded by default).
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("120%")).toBeInTheDocument();
  });

  it("omits the row goal-% when no goal is set", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 0, created_at: null, updated_at: null });
    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("hero-average")).toBeInTheDocument());
    expect(screen.queryByText("80%")).not.toBeInTheDocument();
  });
});

describe("StepsView — week pagination", () => {
  it("fetches the next keyset page when navigating to an older week page", async () => {
    listStepsMock.mockImplementation((_token: string, opts: { before?: string } = {}) => {
      if (opts.before) {
        return Promise.resolve({ steps: [entry(daysAgo(40), 5000)], next_before: null });
      }
      return Promise.resolve({
        steps: [entry(YESTERDAY, 8000), entry(TODAY, 12000)],
        next_before: YESTERDAY,
      });
    });

    render(<StepsView days={30} />);
    await waitFor(() => expect(screen.getByTestId("hero-average")).toBeInTheDocument());

    const older = await screen.findByRole("button", { name: /older/i });
    fireEvent.click(older);

    await waitFor(() =>
      expect(listStepsMock).toHaveBeenCalledWith("tok", { limit: 25, before: YESTERDAY }),
    );
  });
});

describe("StepsView — mutations", () => {
  it("fires deleteStepsForDate and refetches when a row is deleted", async () => {
    deleteStepsMock.mockResolvedValue(undefined);
    render(<StepsView days={30} />);
    const deleteButtons = await screen.findAllByRole("button", { name: /delete steps/i });
    expect(deleteButtons.length).toBeGreaterThan(0);

    const callsBefore = listStepsMock.mock.calls.length;
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => expect(deleteStepsMock).toHaveBeenCalledWith("tok", TODAY));
    await waitFor(() => expect(listStepsMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it("fires upsertStepsForDate when an existing row is edited and saved", async () => {
    upsertStepsMock.mockResolvedValue(undefined);
    render(<StepsView days={30} />);
    const editButtons = await screen.findAllByRole("button", { name: /edit steps/i });
    fireEvent.click(editButtons[0]); // edit the newest row (today)

    const stepsInput = await screen.findByPlaceholderText("10000");
    fireEvent.change(stepsInput, { target: { value: "9500" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(upsertStepsMock).toHaveBeenCalledWith("tok", TODAY, 9500));
  });

  it("opens the Log steps modal from the toolbar and upserts a new day", async () => {
    upsertStepsMock.mockResolvedValue(undefined);
    render(<StepsView days={30} />);
    const logButton = await screen.findByRole("button", { name: /^log steps$/i });
    fireEvent.click(logButton);

    const stepsInput = await screen.findByPlaceholderText("10000");
    fireEvent.change(stepsInput, { target: { value: "7777" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(upsertStepsMock).toHaveBeenCalled());
    const lastCall = upsertStepsMock.mock.calls[upsertStepsMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe("tok");
    expect(lastCall[2]).toBe(7777);
  });

  it("fires putStepsGoal and refetches when the goal is saved", async () => {
    getStepsGoalMock.mockResolvedValue({ goal: 10000, created_at: "x", updated_at: "x" });
    putStepsGoalMock.mockResolvedValue({ goal: 11000, created_at: "x", updated_at: "y" });
    render(<StepsView days={30} />);

    const goalButton = await screen.findByRole("button", { name: /goal 10,000 steps/i });
    fireEvent.click(goalButton);

    const dialog = await screen.findByRole("dialog");
    const input = within(dialog).getByDisplayValue("10000");
    fireEvent.change(input, { target: { value: "11000" } });
    const callsBefore = listStepsMock.mock.calls.length;
    fireEvent.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(putStepsGoalMock).toHaveBeenCalledWith("tok", { goal: 11000 }));
    await waitFor(() => expect(listStepsMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });
});
