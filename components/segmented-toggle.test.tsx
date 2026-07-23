/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import { SegmentedToggle } from "./segmented-toggle";

describe("SegmentedToggle", () => {
  it("marks the active option and fires onChange for another", () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle
        value="mi"
        options={[
          { value: "mi", label: "Miles" },
          { value: "km", label: "Kilometers" },
        ]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "Miles" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Kilometers" }));
    expect(onChange).toHaveBeenCalledWith("km");
  });

  it("does not fire onChange when clicking the already-active option", () => {
    const onChange = vi.fn();
    render(
      <SegmentedToggle
        value="mi"
        options={[
          { value: "mi", label: "Miles" },
          { value: "km", label: "Kilometers" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Miles" }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
