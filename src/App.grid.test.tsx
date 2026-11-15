import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

const setUrl = (search: string) => window.history.replaceState(null, "", `/${search}`);
beforeEach(() => setUrl(""));
afterEach(() => setUrl(""));

describe("grid columns", () => {
  it("shows the Owner, the current Approval Step and the last decision (who, when) of each Approval", async () => {
    render(<App client={createMockClient("multiStep")} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");

    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Title", "Status", "Created on", "Owner", "Current step", "Last decision"]);
    const budget = within(grid).getByRole("row", { name: /Contoso budget approval/ });
    expect(within(budget).getByText("Olga Contoso")).toBeInTheDocument();
    expect(within(budget).getByRole("gridcell", { name: "2" })).toBeInTheDocument();
    expect(within(budget).getByText(/^Ann Contoso, Apr 2, 2025, 9:15\sAM$/)).toBeInTheDocument();
  });

  it("shows the columns of the Profile in its order", async () => {
    const client = { ...createMockClient("multiStep"), loadConfigValue: async () => JSON.stringify({ profiles: { default: { defaultStatus: null, columns: ["owner", "title"] } } }) };
    render(<App client={client} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    expect(within(grid).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Owner", "Title"]);
  });
});

describe("grid sorting", () => {
  it("sorts on the server by the clicked column, ascending first and descending on the second click", async () => {
    const user = userEvent.setup();
    const client = createMockClient("statuses");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");
    expect(screen.getByRole("columnheader", { name: "Created on" })).toHaveAttribute("aria-sort", "descending");

    await user.click(screen.getByRole("columnheader", { name: "Title" }));
    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ sort: { field: "title", descending: false } }, { size: 100 }));
    expect(screen.getByRole("columnheader", { name: "Title" })).toHaveAttribute("aria-sort", "ascending");
    const firstRow = () => within(screen.getByRole("grid")).getAllByRole("row")[1];
    await waitFor(() => expect(firstRow()).toHaveAccessibleName(/Alpha pending/));

    await user.click(screen.getByRole("columnheader", { name: "Title" }));
    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ sort: { field: "title", descending: true } }, { size: 100 }));
    await waitFor(() => expect(firstRow()).toHaveAccessibleName(/Zeta reject/));
  });

  it.each([
    ["Status", "status"],
    ["Created on", "createdOn"],
    ["Owner", "owner"],
    ["Current step", "currentStep"],
  ])("sorts by %s", async (header, field) => {
    const user = userEvent.setup();
    const client = createMockClient("multiStep");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");
    // Created on starts out sorted descending, so its first click turns it around.
    await user.click(screen.getByRole("columnheader", { name: header }));
    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ sort: { field, descending: false } }, { size: 100 }));
  });

  it("does not offer to sort by the last decision, which comes from child rows", async () => {
    render(<App client={createMockClient("multiStep")} lang="en" theme="light" />);
    await screen.findByRole("grid");
    expect(screen.getByRole("columnheader", { name: "Last decision" })).not.toHaveAttribute("aria-sort");
  });
});

describe("grid column resizing", () => {
  it("has a resize handle on every column but the last, which takes the remaining width", async () => {
    render(<App client={createMockClient("multiStep")} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    const headers = within(grid).getAllByRole("columnheader");
    const hasHandle = headers.map((h) => h.querySelector('[role="separator"][aria-label="Resize column"]') !== null);
    expect(hasHandle).toEqual([true, true, true, true, true, false]);
  });
});

describe("grid keyboard", () => {
  it("sorts from the keyboard with Enter on a column header", async () => {
    const user = userEvent.setup();
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    const header = await screen.findByRole("columnheader", { name: "Title" });
    await user.tab();
    const button = within(header).getByRole("button");
    button.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ sort: { field: "title", descending: false } }, { size: 100 }));
  });

  it("moves between rows with the arrow keys, keeps a single row in the tab order and selects with Enter or Space", async () => {
    const user = userEvent.setup();
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    const rows = () => within(grid).getAllByRole("row").slice(1);
    expect(rows().map((r) => r.tabIndex)).toEqual([0, -1, -1]);

    rows()[0].focus();
    await user.keyboard("{ArrowDown}");
    expect(rows()[1]).toHaveFocus();
    expect(rows().map((r) => r.tabIndex)).toEqual([-1, 0, -1]);
    await user.keyboard("{ArrowUp}{ArrowUp}");
    expect(rows()[0]).toHaveFocus();

    await user.keyboard("{ArrowDown}{Enter}");
    expect(await screen.findByRole("heading", { level: 2, name: "Contoso travel request 2002" })).toBeInTheDocument();
    await user.keyboard("{ArrowDown} ");
    expect(await screen.findByRole("heading", { level: 2, name: "Contoso contract renewal 3003" })).toBeInTheDocument();
  });
});
