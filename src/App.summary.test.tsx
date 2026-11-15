import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

const tile = (name: string) => screen.getByRole("group", { name });

afterEach(() => {
  vi.restoreAllMocks();
  // The filters live in the URL, so a search in one test must not leak into the next.
  window.history.replaceState(null, "", "/");
});

describe("summary tiles", () => {
  it("show Pending, Approved, Rejected and Other counts for the whole list", async () => {
    render(<App client={createMockClient("default")} lang="en" theme="light" />);

    await screen.findByRole("grid");
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("1"));
    expect(tile("Approved")).toHaveTextContent("1");
    expect(tile("Rejected")).toHaveTextContent("1");
    expect(tile("Other")).toHaveTextContent("0");
  });

  it("follow the title search once it is applied", async () => {
    const client = createMockClient("statuses");
    render(<App client={client} lang="en" theme="light" />);
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("4"));

    await userEvent.type(screen.getByRole("searchbox", { name: "Search by title" }), "alph");

    await waitFor(() => expect(tile("Pending")).toHaveTextContent("1"));
    expect(tile("Approved")).toHaveTextContent("0");
    expect(tile("Other")).toHaveTextContent("0");
  });

  it("can be hidden and shown again with the command bar toggle", async () => {
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await waitFor(() => expect(tile("Pending")).toBeInTheDocument());

    const toggle = screen.getByRole("switch", { name: "Show summary" });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(screen.queryByRole("group", { name: "Pending" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("1"));
  });
});

describe("Refresh", () => {
  it("reloads the list and the summary tiles", async () => {
    const client = createMockClient("default");
    const listApprovals = vi.spyOn(client, "listApprovals");
    const countByStatus = vi.spyOn(client, "countByStatus");
    render(<App client={client} lang="en" theme="light" />);
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("1"));
    expect(listApprovals).toHaveBeenCalledTimes(1);
    expect(countByStatus).toHaveBeenCalledTimes(1);

    vi.spyOn(client, "countByStatus").mockResolvedValue({ pending: 9, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(listApprovals).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("9"));
  });
});

describe("Export CSV", () => {
  it("downloads every matching Approval across server pages, not only the loaded page", async () => {
    const client = createMockClient("longList");
    const created: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return "blob:approvals-hub-test";
    });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    const text = await created[0].text();
    const lines = text.trim().split("\r\n");
    expect(lines[0]).toBe("Title,Status,Outcome,Created on");
    expect(lines).toHaveLength(5001);
    expect(lines[5000]).toContain("Contoso long list approval 5000");
  });

  it("exports the rows matching the current title search", async () => {
    const client = createMockClient("statuses");
    const exported = vi.spyOn(client, "exportApprovals");
    const createObjectURL = vi.fn(() => "blob:approvals-hub-test");
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<App client={client} lang="en" theme="light" />);
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("4"));
    await userEvent.type(screen.getByRole("searchbox", { name: "Search by title" }), "alph");
    await waitFor(() => expect(tile("Pending")).toHaveTextContent("1"));
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));

    await waitFor(() => expect(createObjectURL).toHaveBeenCalledTimes(1));
    expect(exported).toHaveBeenLastCalledWith({ title: "alph" });
  });
});

describe("summary and commands in Polish", () => {
  it("labels the commands and tiles in Polish", async () => {
    render(<App client={createMockClient("default")} lang="pl" theme="light" />);
    await screen.findByRole("grid");
    expect(screen.getByRole("button", { name: "Odśwież" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eksportuj CSV" })).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Podsumowanie" })).getByRole("group", { name: "Inne" })).toBeInTheDocument();
  });
});
