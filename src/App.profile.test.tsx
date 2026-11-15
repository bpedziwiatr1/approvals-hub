import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";
import type { DataClient } from "./data/dataClient";

const setUrl = (search: string) => window.history.replaceState(null, "", `/${search}`);

beforeEach(() => setUrl(""));
afterEach(() => setUrl(""));

const withConfig = (raw: string | null): DataClient => ({ ...createMockClient("default"), loadConfigValue: async () => raw });

describe("Profile selection", () => {
  it("applies the page title, page size and Profile Scope of ?profile= on the mock client", async () => {
    setUrl("?profile=purchasing");
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);

    expect(await screen.findByRole("heading", { level: 1, name: "Purchasing approvals" })).toBeInTheDocument();
    const grid = await screen.findByRole("grid");
    await waitFor(() => expect(within(grid).getAllByRole("row")).toHaveLength(2));
    expect(within(grid).getByText("Contoso purchase order 1001")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledWith({ scope: { category: "Purchasing" } }, { size: 50 });
  });

  it("selects the Profile through the web resource data parameter", async () => {
    setUrl("?data=profile%3Dpurchasing");
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Purchasing approvals" })).toBeInTheDocument();
  });

  it("uses the default Profile and the built-in title when none is requested", async () => {
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("resolves extends: a child Profile inherits the parent's page size and overrides its scope", async () => {
    setUrl("?profile=travel&status=approved");
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    expect(within(grid).getByText("Contoso travel request 2002")).toBeInTheDocument();
    expect(listApprovals).toHaveBeenCalledWith({ scope: { category: "Travel" }, statuses: ["approved"] }, { size: 50 });
  });

  it("starts on the Profile's default status when the URL has none, and lets the URL override it", async () => {
    setUrl("?profile=travel");
    const { unmount } = render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(await screen.findByRole("checkbox", { name: "Approved" })).toBeChecked();
    unmount();

    setUrl("?profile=travel&status=rejected");
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(await screen.findByRole("checkbox", { name: "Rejected" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Approved" })).not.toBeChecked();
  });
});

describe("Profile Scope", () => {
  it("is applied to every query, title search included, and never shows in the URL", async () => {
    setUrl("?profile=purchasing");
    const user = userEvent.setup();
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.type(screen.getByRole("searchbox", { name: "Search by title" }), "travel");
    await user.click(screen.getByRole("checkbox", { name: "Pending" }));

    await waitFor(() =>
      expect(listApprovals).toHaveBeenLastCalledWith({ scope: { category: "Purchasing" }, title: "travel", statuses: ["pending"] }, { size: 50 }),
    );
    // Scope wins over the search: a Travel approval is out of scope, so nothing is found.
    expect(await screen.findByText("No approvals found")).toBeInTheDocument();
    for (const call of listApprovals.mock.calls) expect(call[0].scope).toEqual({ category: "Purchasing" });

    const params = new URLSearchParams(window.location.search);
    expect(params.get("q")).toBe("travel");
    expect([...params.keys()].sort()).toEqual(["profile", "q", "status"]);
  });

  it("has no control that removes it", async () => {
    setUrl("?profile=purchasing");
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await screen.findByRole("grid");
    // Only the page commands exist; nothing that removes or edits the scope.
    expect(screen.queryAllByRole("button").map((b) => b.textContent)).toEqual(["Refresh", "Export CSV"]);
    expect(screen.queryByText(/Purchasing$/)).toBeNull();
  });
});

describe("Configuration problems", () => {
  it("shows a readable message and the default page for an invalid configuration", async () => {
    render(<App client={withConfig('{"profiles":{"default":{"pageSize":0}}}')} lang="en" theme="light" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/configuration is invalid/i);
    expect(alert).toHaveTextContent("profiles.default.pageSize");
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
  });

  it("falls back to the defaults when the configuration is not JSON", async () => {
    render(<App client={withConfig("{ nope")} lang="en" theme="light" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/configuration is invalid/i);
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("falls back to the defaults when the configuration cannot be read", async () => {
    const client = { ...createMockClient("default"), loadConfigValue: () => Promise.reject(new Error("no access")) };
    render(<App client={client} lang="en" theme="light" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("no access");
    expect(await screen.findByRole("grid")).toBeInTheDocument();
  });

  it("names an unknown profile and shows the default one", async () => {
    setUrl("?profile=ghost");
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(await screen.findByRole("alert")).toHaveTextContent('Profile "ghost" does not exist');
    expect(await screen.findByRole("grid")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
  });

  it("shows the messages in Polish", async () => {
    setUrl("?profile=ghost");
    render(<App client={createMockClient("default")} lang="pl" theme="light" />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/ghost/);
    expect(screen.getByRole("alert")).not.toHaveTextContent("does not exist");
  });
});
