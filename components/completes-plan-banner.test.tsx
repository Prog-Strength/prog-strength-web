/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CompletesPlanBanner } from "./completes-plan-banner";

const unlinkMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  unlinkPlannedWorkout: unlinkMock,
}));

const PLAN = { id: "p1", name: "Easy Run", activity_kind: "run", status: "completed" } as never;

describe("CompletesPlanBanner", () => {
  it("renders the plan name and unlinks on click", async () => {
    unlinkMock.mockResolvedValue({ id: "p1", status: "planned" });
    const onUnlinked = vi.fn();
    render(<CompletesPlanBanner plan={PLAN} onUnlinked={onUnlinked} />);
    expect(screen.getByText(/Completes your planned Easy Run/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Unlink" }));
    await waitFor(() => expect(unlinkMock).toHaveBeenCalledWith("test-token", "p1"));
    await waitFor(() => expect(onUnlinked).toHaveBeenCalled());
    expect(screen.queryByText(/Completes your planned Easy Run/)).not.toBeInTheDocument();
  });
});
