/// <reference types="vitest/globals" />

import { render, screen, fireEvent } from "@testing-library/react";
import { MAX_SECTION_TITLE_LEN } from "./layout-ops";
import { SectionHeader } from "./section-header";

const noop = () => {};

function renderHeader(props: Partial<React.ComponentProps<typeof SectionHeader>> = {}) {
  return render(
    <SectionHeader
      title="Recovery"
      index={0}
      collapsed={false}
      tileCount={2}
      mode="view"
      onToggleCollapsed={noop}
      onRename={noop}
      onDelete={noop}
      onAddTile={noop}
      {...props}
    />,
  );
}

describe("SectionHeader — view mode", () => {
  it("renders the title as a heading", () => {
    renderHeader();
    expect(screen.getByRole("heading", { level: 2, name: "Recovery" })).toBeInTheDocument();
  });

  // The migration wraps every pre-sections layout into ONE untitled section.
  // If that rendered a header, every existing user would see a new empty label
  // over their dashboard on the day this ships.
  it("renders nothing at all for an untitled section", () => {
    const { container } = renderHeader({ title: "" });
    expect(container).toBeEmptyDOMElement();
  });

  it("exposes collapse state via aria-expanded and fires the toggle", () => {
    const onToggleCollapsed = vi.fn();
    renderHeader({ onToggleCollapsed });

    const button = screen.getByRole("button", { name: "Collapse Recovery" });
    expect(button).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(button);
    expect(onToggleCollapsed).toHaveBeenCalled();
  });

  it("labels the control for expanding and counts the hidden tiles when collapsed", () => {
    renderHeader({ collapsed: true });

    const button = screen.getByRole("button", { name: "Expand Recovery" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("2 tiles")).toBeInTheDocument();
  });

  it("singularizes the collapsed tile count", () => {
    renderHeader({ collapsed: true, tileCount: 1 });
    expect(screen.getByText("1 tile")).toBeInTheDocument();
  });

  it("shows no count when a collapsed section is empty", () => {
    renderHeader({ collapsed: true, tileCount: 0 });
    expect(screen.queryByText(/tiles?$/)).toBeNull();
  });

  it("offers no rename or delete control", () => {
    renderHeader();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });
});

describe("SectionHeader — edit mode", () => {
  // The inverse of the view-mode rule: an invisible section in edit mode would
  // have no handle to rename, delete, or add into.
  it("renders even when untitled, naming itself positionally", () => {
    renderHeader({ mode: "edit", title: "", index: 2 });
    expect(
      screen.getByRole("textbox", { name: "Title for Untitled section 3" }),
    ).toBeInTheDocument();
  });

  it("fires onRename as the title is typed", () => {
    const onRename = vi.fn();
    renderHeader({ mode: "edit", onRename });

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Endurance" } });
    expect(onRename).toHaveBeenCalledWith("Endurance");
  });

  it("caps the title input at the API's limit", () => {
    renderHeader({ mode: "edit" });
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", String(MAX_SECTION_TITLE_LEN));
  });

  it("fires onDelete and onAddTile from their controls", () => {
    const onDelete = vi.fn();
    const onAddTile = vi.fn();
    renderHeader({ mode: "edit", onDelete, onAddTile });

    fireEvent.click(screen.getByRole("button", { name: "Delete Recovery" }));
    expect(onDelete).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add tile" }));
    expect(onAddTile).toHaveBeenCalled();
  });

  it("renders the supplied drag handle", () => {
    renderHeader({
      mode: "edit",
      dragHandle: <button type="button">Reorder Recovery</button>,
    });
    expect(screen.getByRole("button", { name: "Reorder Recovery" })).toBeInTheDocument();
  });

  // Collapsing is a view-mode affordance: a section you cannot see into is one
  // you cannot drag tiles out of.
  it("offers no collapse control", () => {
    renderHeader({ mode: "edit" });
    expect(screen.queryByRole("button", { name: /Collapse|Expand/ })).toBeNull();
  });
});
