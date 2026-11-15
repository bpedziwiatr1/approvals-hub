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

describe("Assigned to me", () => {
  it("lists the Approvals where the current user has an Approval Request (currentUserIsApprover)", async () => {
    const user = userEvent.setup();
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    expect(within(grid).getAllByRole("row")).toHaveLength(5);

    await user.click(screen.getByRole("checkbox", { name: "Assigned to me" }));

    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ assignedToMe: { pendingOnly: false } }, { size: 100 }));
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(3));
    expect(within(screen.getByRole("grid")).getByText("Alpha mine pending")).toBeInTheDocument();
    expect(within(screen.getByRole("grid")).getByText("Beta mine decided")).toBeInTheDocument();
  });

  it("narrows to requests still waiting for a response with Pending only", async () => {
    const user = userEvent.setup();
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");
    expect(screen.getByRole("checkbox", { name: "Pending only" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Assigned to me" }));
    await user.click(screen.getByRole("checkbox", { name: "Pending only" }));

    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ assignedToMe: { pendingOnly: true } }, { size: 100 }));
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(2));
    expect(within(screen.getByRole("grid")).getByText("Alpha mine pending")).toBeInTheDocument();
  });

  it("shows no results when the current user has no Approval Request (currentUserNotApprover)", async () => {
    const user = userEvent.setup();
    render(<App client={createMockClient("currentUserNotApprover")} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.click(screen.getByRole("checkbox", { name: "Assigned to me" }));

    expect(await screen.findByText("No approvals found")).toBeInTheDocument();
  });
});

describe("Owner, Approver and created-on range", () => {
  const OWNER = "00000000-0000-0000-0000-000000000e01";
  const APPROVER = "00000000-0000-0000-0000-0000000000b1";

  it("filters by Owner once a valid user id is entered", async () => {
    const user = userEvent.setup();
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.type(screen.getByRole("textbox", { name: "Owner (user ID)" }), OWNER.slice(0, 20));
    expect(listApprovals).toHaveBeenCalledTimes(1);
    await user.type(screen.getByRole("textbox", { name: "Owner (user ID)" }), OWNER.slice(20));

    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ ownerId: OWNER }, { size: 100 }));
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(3));
  });

  it("filters by Approver", async () => {
    const user = userEvent.setup();
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.type(screen.getByRole("textbox", { name: "Approver (user ID)" }), APPROVER);

    await waitFor(() => expect(listApprovals).toHaveBeenLastCalledWith({ approverId: APPROVER }, { size: 100 }));
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(3));
  });

  it("sends the chosen days as inclusive ISO UTC boundaries", async () => {
    const user = userEvent.setup();
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.type(screen.getByLabelText("Created from"), "2025-05-02");
    await user.type(screen.getByLabelText("Created to"), "2025-05-02");

    await waitFor(() =>
      expect(listApprovals).toHaveBeenLastCalledWith({ createdFrom: "2025-05-02T00:00:00.000Z", createdTo: "2025-05-02T23:59:59.999Z" }, { size: 100 }),
    );
    await waitFor(() => expect(within(screen.getByRole("grid")).getAllByRole("row")).toHaveLength(2));
    expect(within(screen.getByRole("grid")).getByText("Beta mine decided")).toBeInTheDocument();
  });

  it("restores every filter from the URL and writes them back", async () => {
    setUrl(`?owner=${OWNER}&approver=${APPROVER}&from=2025-05-01&to=2025-05-31&mine=pending&scenario=currentUserIsApprover`);
    const client = createMockClient("currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);

    await waitFor(() => expect(listApprovals).toHaveBeenCalled());
    expect(listApprovals.mock.calls[0][0]).toEqual({
      ownerId: OWNER,
      approverId: APPROVER,
      createdFrom: "2025-05-01T00:00:00.000Z",
      createdTo: "2025-05-31T23:59:59.999Z",
      assignedToMe: { pendingOnly: true },
    });
    expect(screen.getByRole("textbox", { name: "Owner (user ID)" })).toHaveValue(OWNER);
    expect(screen.getByLabelText("Created from")).toHaveValue("2025-05-01");
    expect(screen.getByRole("checkbox", { name: "Assigned to me" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Pending only" })).toBeChecked();
    await waitFor(() => expect(window.location.search).toContain(`owner=${OWNER}`));
    expect(window.location.search).toContain("mine=pending");
  });
});
