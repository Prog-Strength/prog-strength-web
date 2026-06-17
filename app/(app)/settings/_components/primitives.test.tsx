// app/(app)/settings/_components/primitives.test.tsx
/// <reference types="vitest/globals" />
import { render, screen, fireEvent } from "@testing-library/react";
import { Card, Field, SegmentedToggle } from "./primitives";

describe("Card", () => {
  it("renders the title and children", () => {
    render(
      <Card title="Profile">
        <p>body</p>
      </Card>,
    );
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
  });
});

describe("Field", () => {
  it("renders the label, hint, and control", () => {
    render(
      <Field label="Display name" hint="What your coach calls you">
        <input aria-label="x" />
      </Field>,
    );
    expect(screen.getByText("Display name")).toBeInTheDocument();
    expect(screen.getByText("What your coach calls you")).toBeInTheDocument();
    expect(screen.getByLabelText("x")).toBeInTheDocument();
  });
});

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
