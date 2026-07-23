// app/(app)/settings/_components/primitives.test.tsx
/// <reference types="vitest/globals" />
import { render, screen } from "@testing-library/react";
import { Card, Field } from "./primitives";

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
