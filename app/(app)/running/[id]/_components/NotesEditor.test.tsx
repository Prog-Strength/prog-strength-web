/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { NotesEditor } from "./NotesEditor";

describe("NotesEditor", () => {
  it("empty state shows the dashed affordance and opens a textarea on click", () => {
    render(<NotesEditor notes={null} onSave={vi.fn()} />);

    const affordance = screen.getByRole("button", { name: "How did this run feel?" });
    expect(affordance).toBeInTheDocument();

    fireEvent.click(affordance);
    expect(screen.getByPlaceholderText("How did this run feel?")).toBeInstanceOf(
      HTMLTextAreaElement,
    );
  });

  it("typing + ⌘-Enter commits with the entered text", () => {
    const onSave = vi.fn();
    render(<NotesEditor notes={null} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "How did this run feel?" }));
    const textarea = screen.getByPlaceholderText("How did this run feel?");
    fireEvent.change(textarea, { target: { value: "Legs felt strong" } });
    fireEvent.keyDown(textarea, { key: "Enter", metaKey: true });

    expect(onSave).toHaveBeenCalledWith("Legs felt strong");
  });

  it("Escape reverts without calling onSave", () => {
    const onSave = vi.fn();
    render(<NotesEditor notes={null} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "How did this run feel?" }));
    const textarea = screen.getByPlaceholderText("How did this run feel?");
    fireEvent.change(textarea, { target: { value: "Discarded" } });
    fireEvent.keyDown(textarea, { key: "Escape" });

    expect(onSave).not.toHaveBeenCalled();
    // Back to the empty affordance, no textarea.
    expect(screen.getByRole("button", { name: "How did this run feel?" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("How did this run feel?")).not.toBeInTheDocument();
  });

  it("commits on blur", () => {
    const onSave = vi.fn();
    render(<NotesEditor notes={null} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "How did this run feel?" }));
    const textarea = screen.getByPlaceholderText("How did this run feel?");
    fireEvent.change(textarea, { target: { value: "Committed on blur" } });
    fireEvent.blur(textarea);

    expect(onSave).toHaveBeenCalledWith("Committed on blur");
  });

  it("renders a filled note as prose with whitespace preserved", () => {
    render(<NotesEditor notes={"Hard\ntempo effort"} onSave={vi.fn()} />);

    const prose = screen.getByText(/Hard\s+tempo effort/);
    expect(prose).toHaveClass("whitespace-pre-wrap");
    // It is click-to-edit, not a plain <p>.
    expect(screen.getByRole("button", { name: /Hard/ })).toBeInTheDocument();
  });

  it("caps the textarea at 2000 characters", () => {
    render(<NotesEditor notes={null} onSave={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "How did this run feel?" }));
    const textarea = screen.getByPlaceholderText("How did this run feel?") as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(2000);
  });
});
