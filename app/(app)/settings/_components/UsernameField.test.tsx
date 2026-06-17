// app/(app)/settings/_components/UsernameField.test.tsx
/// <reference types="vitest/globals" />
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const checkUsernameAvailableMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  checkUsernameAvailable: checkUsernameAvailableMock,
}));
vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));

import { UsernameField } from "./UsernameField";

function setup(over: Partial<React.ComponentProps<typeof UsernameField>> = {}) {
  const onChange = vi.fn();
  const onBlockedChange = vi.fn();
  render(
    <UsernameField
      value="sam"
      original="sam"
      disabled={false}
      onChange={onChange}
      onBlockedChange={onBlockedChange}
      {...over}
    />,
  );
  return { onChange, onBlockedChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  checkUsernameAvailableMock.mockResolvedValue(true);
});

describe("UsernameField", () => {
  it("renders the @-prefixed current value", () => {
    setup();
    expect(screen.getByLabelText("Username")).toHaveValue("sam");
  });

  it("lowercases input through onChange", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "NewSam" } });
    expect(onChange).toHaveBeenCalledWith("newsam");
  });

  it("shows the charset hint and blocks for an invalid dirty handle, skipping the probe", async () => {
    const { onBlockedChange } = setup({ value: "1bad", original: "sam" });
    await waitFor(() =>
      expect(screen.getByText(/3–30 characters: start with a letter/)).toBeInTheDocument(),
    );
    expect(checkUsernameAvailableMock).not.toHaveBeenCalled();
    expect(onBlockedChange).toHaveBeenCalledWith(true);
  });

  it("probes and shows available for a free valid handle, unblocking", async () => {
    const { onBlockedChange } = setup({ value: "newhandle", original: "sam" });
    await waitFor(() =>
      expect(checkUsernameAvailableMock).toHaveBeenCalledWith("test-token", "newhandle"),
    );
    await waitFor(() => expect(screen.getByText("@newhandle is available.")).toBeInTheDocument());
    await waitFor(() => expect(onBlockedChange).toHaveBeenLastCalledWith(false));
  });

  it("shows taken and blocks when the probe returns taken", async () => {
    checkUsernameAvailableMock.mockResolvedValue(false);
    const { onBlockedChange } = setup({ value: "occupied", original: "sam" });
    await waitFor(() => expect(screen.getByText("@occupied is taken.")).toBeInTheDocument());
    await waitFor(() => expect(onBlockedChange).toHaveBeenLastCalledWith(true));
  });

  it("is idle and unblocked when the handle equals the original", () => {
    const { onBlockedChange } = setup({ value: "sam", original: "sam" });
    expect(checkUsernameAvailableMock).not.toHaveBeenCalled();
    expect(onBlockedChange).toHaveBeenLastCalledWith(false);
  });
});
