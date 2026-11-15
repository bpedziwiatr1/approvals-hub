import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

describe("Approvals list", () => {
  it("lists Approvals from the default scenario with title, display status and created on", async () => {
    render(<App client={createMockClient("default")} lang="en" theme="light" />);

    const grid = await screen.findByRole("grid");
    const rows = within(grid).getAllByRole("row");
    // header row + 3 approvals
    expect(rows).toHaveLength(4);

    expect(within(grid).getByText("Contoso purchase order 1001")).toBeInTheDocument();
    expect(within(grid).getByText("Pending")).toBeInTheDocument();
    expect(within(grid).getByText("Approved")).toBeInTheDocument();
    expect(within(grid).getByText("Rejected")).toBeInTheDocument();
    expect(within(grid).getAllByText(/2025/)).toHaveLength(3);
  });

  it("shows the page title and column headers in Polish when lang is pl", async () => {
    render(<App client={createMockClient("default")} lang="pl" theme="light" />);
    expect(await screen.findByRole("heading", { name: "Centrum zatwierdzeń" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Tytuł/ })).toBeInTheDocument();
  });
});
