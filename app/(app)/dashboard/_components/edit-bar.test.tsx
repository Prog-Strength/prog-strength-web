/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { EditBar } from "./edit-bar";

const noop = () => {};

describe("EditBar", () => {
  it("view mode shows Customize and fires onCustomize", () => {
    const onCustomize = vi.fn();
    render(
      <EditBar
        mode="view"
        saving={false}
        saveError={null}
        onCustomize={onCustomize}
        onCancel={noop}
        onDone={noop}
      />,
    );

    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    expect(onCustomize).toHaveBeenCalledOnce();
  });

  it("edit mode shows Cancel/Done and fires their handlers", () => {
    const onCancel = vi.fn();
    const onDone = vi.fn();
    render(
      <EditBar
        mode="edit"
        saving={false}
        saveError={null}
        onCustomize={noop}
        onCancel={onCancel}
        onDone={onDone}
      />,
    );

    expect(screen.queryByRole("button", { name: "Customize" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("disables Done and shows Saving… while saving", () => {
    render(
      <EditBar
        mode="edit"
        saving={true}
        saveError={null}
        onCustomize={noop}
        onCancel={noop}
        onDone={noop}
      />,
    );

    const done = screen.getByRole("button", { name: "Saving…" });
    expect(done).toBeDisabled();
  });

  it("renders saveError when set", () => {
    render(
      <EditBar
        mode="edit"
        saving={false}
        saveError="Could not save layout"
        onCustomize={noop}
        onCancel={noop}
        onDone={noop}
      />,
    );

    expect(screen.getByText("Could not save layout")).toBeInTheDocument();
  });
});
