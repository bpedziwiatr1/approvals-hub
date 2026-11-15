import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

const setUrl = (search: string) => window.history.replaceState(null, "", `/${search}`);

beforeEach(() => setUrl(""));
afterEach(() => {
  vi.useRealTimers();
  setUrl("");
});

describe("Title search", () => {
  it("queries the server once, after typing stops, and narrows the list", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");
    expect(listApprovals).toHaveBeenCalledTimes(1);

    await user.type(screen.getByRole("searchbox", { name: "Search by title" }), "TRAVEL");
    expect(listApprovals).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(500));

    await waitFor(() => expect(listApprovals).toHaveBeenCalledTimes(2));
    expect(listApprovals.mock.calls[1][0]).toEqual({ title: "TRAVEL" });
    const grid = await screen.findByRole("grid");
    await waitFor(() => expect(within(grid).getAllByRole("row")).toHaveLength(2));
    expect(within(grid).getByText("Contoso travel request 2002")).toBeInTheDocument();
  });
});

describe("Status filter", () => {
  it("sends the chosen statuses to the server and narrows the list", async () => {
    const user = userEvent.setup();
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.click(screen.getByRole("checkbox", { name: "Rejected" }));

    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ statuses: ["rejected"] }, { size: 100 }));
    const grid = await screen.findByRole("grid");
    await waitFor(() => expect(within(grid).getAllByRole("row")).toHaveLength(2));
    expect(within(grid).getByText("Contoso contract renewal 3003")).toBeInTheDocument();
  });

  it("shows a no-results state when nothing matches", async () => {
    const user = userEvent.setup();
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await screen.findByRole("grid");
    await user.click(screen.getByRole("checkbox", { name: "Expired" }));
    expect(await screen.findByText("No approvals found")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Expired" })).toBeInTheDocument();
  });
});

describe("Status badges", () => {
  it("show an icon and a label, not colour alone", async () => {
    render(<App client={createMockClient("statuses")} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    const label = within(grid).getByText("Cancelled");
    const badge = label.closest("[data-status]") as HTMLElement;
    expect(badge).toHaveAttribute("data-status", "cancelled");
    expect(badge.querySelector("svg")).not.toBeNull();
  });

  it("show the Outcome text for Completed with a custom option", async () => {
    render(<App client={createMockClient("statuses")} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    expect(within(grid).getByText("Send back")).toBeInTheDocument();
  });
});

describe("Filters in the URL", () => {
  it("restores title and statuses from the query string", async () => {
    setUrl("?q=contoso&status=approved,rejected&scenario=default");
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);

    await screen.findByRole("grid");
    expect(listApprovals).toHaveBeenCalledTimes(1);
    expect(listApprovals.mock.calls[0][0]).toEqual({ title: "contoso", statuses: ["approved", "rejected"] });
    expect(screen.getByRole("searchbox", { name: "Search by title" })).toHaveValue("contoso");
    expect(screen.getByRole("checkbox", { name: "Approved" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pending" })).not.toBeChecked();
  });

  it("writes the filters to the query string and keeps other parameters", async () => {
    setUrl("?scenario=default");
    const user = userEvent.setup();
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.click(screen.getByRole("checkbox", { name: "Pending" }));

    await waitFor(() => expect(window.location.search).toBe("?scenario=default&status=pending"));
  });
});
