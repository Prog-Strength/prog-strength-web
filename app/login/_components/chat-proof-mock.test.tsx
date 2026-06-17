/// <reference types="vitest/globals" />

import { render, screen, within } from "@testing-library/react";
import { ChatProofMock } from "./chat-proof-mock";
import { chatProof } from "../_fixtures";

describe("ChatProofMock", () => {
  it("renders the static turkey-burger exchange with the tool chip and model attribution", () => {
    render(<ChatProofMock />);

    expect(screen.getByText(chatProof.userMessage)).toBeInTheDocument();
    // The ✓ Log Consumption tool chip and the "via Sonnet 4.6" attribution
    // are the signals that the AI did the logging.
    expect(screen.getByText(/log consumption/i)).toBeInTheDocument();
    expect(screen.getByText(/via sonnet 4\.6/i)).toBeInTheDocument();
    expect(screen.getByText(chatProof.closing)).toBeInTheDocument();
  });

  it("renders the macro table with each item and the bold Total row", () => {
    render(<ChatProofMock />);

    const table = screen.getByRole("table");
    // Column headers: Item · Cal · P · F · C.
    ["Item", "Cal", "P", "F", "C"].forEach((h) => {
      expect(within(table).getByRole("columnheader", { name: h })).toBeInTheDocument();
    });

    // Each fixture item is present.
    chatProof.items.forEach((row) => {
      expect(within(table).getByText(row.item)).toBeInTheDocument();
    });

    // The Total row carries the summed macros: 550 / 36 / 14 / 73.
    const totalRow = within(table).getByText("Total").closest("tr");
    expect(totalRow).not.toBeNull();
    const totalCells = within(totalRow as HTMLElement);
    expect(totalCells.getByText("550")).toBeInTheDocument();
    expect(totalCells.getByText("36g")).toBeInTheDocument();
    expect(totalCells.getByText("14g")).toBeInTheDocument();
    expect(totalCells.getByText("73g")).toBeInTheDocument();
  });
});
