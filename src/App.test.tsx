import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("renders only a window of a long list and loads the next server page only when scrolled near the end", async () => {
    const client = createMockClient("longList");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);

    const grid = await screen.findByRole("grid");
    expect(within(grid).getByText("Contoso long list approval 0001")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledTimes(1);
    expect(within(grid).getAllByRole("row").length).toBeLessThan(80);
    expect(within(grid).queryByText("Contoso long list approval 0100")).not.toBeInTheDocument();

    // Near the end of the first page of 100 rows (jsdom has no layout, so scrollTop is set directly).
    fireEvent.scroll(screen.getByRole("region", { name: "Approvals list" }), { target: { scrollTop: 4_200 } });

    expect(await within(grid).findByText("Contoso long list approval 0100")).toBeInTheDocument();
    expect(within(grid).queryByText("Contoso long list approval 0001")).not.toBeInTheDocument();
    await waitFor(() => expect(listApprovals).toHaveBeenCalledTimes(2));
    expect(listApprovals.mock.calls[1][1]).toEqual({ size: 100, continuationToken: "100" });
    expect(within(grid).getAllByRole("row").length).toBeLessThan(80);
  });

  it("shows the page title and column headers in Polish when lang is pl", async () => {
    render(<App client={createMockClient("default")} lang="pl" theme="light" />);
    expect(await screen.findByRole("heading", { name: "Centrum zatwierdzeń" })).toBeInTheDocument();
    expect(await screen.findByRole("columnheader", { name: /Tytuł/ })).toBeInTheDocument();
  });
});
