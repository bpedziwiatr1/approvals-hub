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
    expect(screen.getByRole("columnheader", { name: /Tytuł/ })).toBeInTheDocument();
  });
});

describe("Approval detail pane", () => {
  const openRow = async (client = createMockClient("multiStep"), title = "Contoso budget approval") => {
    render(<App client={client} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    fireEvent.click(within(grid).getByText(title));
    return screen.findByRole("complementary", { name: "Approval details" });
  };

  it("shows nothing selected until a row is chosen", async () => {
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await screen.findByRole("grid");
    expect(screen.getByText("Select an approval to see its details")).toBeInTheDocument();
  });

  it("shows the timeline grouped by Approval Step with Approver, response, date and comment", async () => {
    const pane = await openRow();

    const step1 = within(await within(pane).findByRole("group", { name: "Step 1: Manager" }));
    expect(step1.getByText("Ann Contoso")).toBeInTheDocument();
    expect(step1.getByText("Approve")).toBeInTheDocument();
    expect(step1.getByText("Within budget")).toBeInTheDocument();
    const expectedDate = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date("2025-04-02T09:15:00Z"));
    expect(step1.getByText(expectedDate)).toBeInTheDocument();

    const step2 = within(within(pane).getByRole("group", { name: "Step 2: Finance" }));
    expect(step2.getByText("Waiting for")).toBeInTheDocument();
    expect(step2.getByText("Bob Contoso")).toBeInTheDocument();
    expect(step2.getByText(/Reassigned/)).toBeInTheDocument();
    expect(step2.getByText("Carol Contoso")).toBeInTheDocument();
  });

  it("shows the Outcome of a completed Approval, including custom response options", async () => {
    const pane = await openRow(createMockClient("multiStep"), "Contoso rework request");
    expect(await within(pane).findByText("Outcome")).toBeInTheDocument();
    expect(within(pane).getAllByText("Send back").length).toBeGreaterThan(0);
  });

  it("renders the details as markdown", async () => {
    const pane = await openRow();
    expect(await within(pane).findByRole("link", { name: "Budget sheet" })).toHaveAttribute("href", "https://example.com/budget");
    expect(within(pane).getByRole("table")).toBeInTheDocument();
  });

  it("does not execute scripts or raw HTML hidden in the details", async () => {
    const client = createMockClient("default");
    const detail = await client.getApprovalDetail("00000000-0000-0000-0000-00000000a001");
    client.getApprovalDetail = async () => ({
      ...detail,
      details: 'Hi <script>window.__pwned = 1</script><img src=x onerror="window.__pwned = 2"><b id="raw">bold</b>\n\n[click](javascript:window.__pwned=3)',
    });
    render(<App client={client} lang="en" theme="light" />);
    fireEvent.click(await screen.findByText("Contoso purchase order 1001"));
    const pane = await screen.findByRole("complementary", { name: "Approval details" });
    await within(pane).findByText(/Hi/);

    expect(pane.querySelector("script, img, #raw")).toBeNull();
    expect(pane.querySelector("a[href^='javascript']")).toBeNull();
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });

  it("shows a readable error with Retry when the detail cannot be loaded", async () => {
    const client = createMockClient("default");
    let calls = 0;
    const real = client.getApprovalDetail.bind(client);
    client.getApprovalDetail = async (id) => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return real(id);
    };
    render(<App client={client} lang="en" theme="light" />);
    fireEvent.click(await screen.findByText("Contoso purchase order 1001"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not load the approval details");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("heading", { name: "Contoso purchase order 1001" })).toBeInTheDocument();
  });
});
