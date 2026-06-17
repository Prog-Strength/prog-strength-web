// app/(app)/settings/_components/SaveBar.test.tsx
/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import { SaveBar } from "./SaveBar";

const base = {
  dirtyCount: 0,
  canSave: false,
  blockReason: null as string | null,
  savedFlash: false,
  saving: false,
  onSave: () => {},
  onDiscard: () => {},
};

describe("SaveBar", () => {
  it("renders nothing when clean and not flashing", () => {
    const { container } = render(<SaveBar {...base} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a singular count for one change", () => {
    render(<SaveBar {...base} dirtyCount={1} canSave />);
    expect(screen.getByText("1 unsaved change")).toBeInTheDocument();
  });

  it("shows a plural count for many changes", () => {
    render(<SaveBar {...base} dirtyCount={3} canSave />);
    expect(screen.getByText("3 unsaved changes")).toBeInTheDocument();
  });

  it("shows the block reason instead of the count when blocked", () => {
    render(<SaveBar {...base} dirtyCount={2} canSave={false} blockReason="fix username first" />);
    expect(screen.getByText("fix username first")).toBeInTheDocument();
    expect(screen.queryByText("2 unsaved changes")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("enables Save and fires onSave when allowed", () => {
    const onSave = vi.fn();
    render(<SaveBar {...base} dirtyCount={1} canSave onSave={onSave} />);
    const btn = screen.getByRole("button", { name: "Save changes" });
    expect(btn).toBeEnabled();
    fireEvent.click(btn);
    expect(onSave).toHaveBeenCalled();
  });

  it("fires onDiscard from the Discard button", () => {
    const onDiscard = vi.fn();
    render(<SaveBar {...base} dirtyCount={1} canSave onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalled();
  });

  it("shows the saved flash and hides the action buttons", () => {
    render(<SaveBar {...base} dirtyCount={0} savedFlash />);
    expect(screen.getByText("All changes saved ✓")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });

  it("shows a saving label on the Save button while saving", () => {
    render(<SaveBar {...base} dirtyCount={1} canSave saving />);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  });
});
