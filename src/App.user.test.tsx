import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { CurrentUser, DataClient } from "./data/dataClient";
import { createMockClient } from "./data/mockClient";

const setUrl = (search: string) => window.history.replaceState(null, "", `/${search}`);
beforeEach(() => setUrl(""));
afterEach(() => setUrl(""));

const ME: CurrentUser = { id: "00000000-0000-0000-0000-0000000000f1", name: "Alex Contoso", languageId: 1033, timeZoneOffsetMinutes: 0 };
const asUser = (user: Partial<CurrentUser>, scenario: Parameters<typeof createMockClient>[0] = "default"): DataClient => ({
  ...createMockClient(scenario),
  getCurrentUser: async () => ({ ...ME, ...user }),
});

describe("language of the user", () => {
  it("is Polish for Dataverse language 1045 and English otherwise, when no ?lang= is given", async () => {
    const { unmount } = render(<App client={asUser({ languageId: 1045 })} theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Centrum zatwierdzeń" })).toBeInTheDocument();
    unmount();
    render(<App client={asUser({ languageId: 1031 })} theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
  });

  it("lets ?lang= override the language of the user", async () => {
    render(<App client={asUser({ languageId: 1045 })} lang="en" theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
  });

  it("falls back to English when the user cannot be read", async () => {
    const client = { ...createMockClient("default"), getCurrentUser: () => Promise.reject(new Error("no user")) };
    render(<App client={client} theme="light" />);
    expect(await screen.findByRole("heading", { level: 1, name: "Approvals Hub" })).toBeInTheDocument();
  });
});

describe("time zone of the user", () => {
  // "Contoso purchase order 1001" was created 2025-03-12T08:30:00Z.
  it("shows created on in the user's time zone", async () => {
    render(<App client={asUser({ timeZoneOffsetMinutes: 120 })} lang="en" theme="light" />);
    const grid = await screen.findByRole("grid");
    expect(within(grid).getByText(/^Mar 12, 2025, 10:30\sAM$/)).toBeInTheDocument();
  });

  it("applies the date range to the user's days, not UTC days", async () => {
    const user = userEvent.setup();
    const client = asUser({ timeZoneOffsetMinutes: 60 }, "currentUserIsApprover");
    const listApprovals = vi.spyOn(client, "listApprovals");
    render(<App client={client} lang="en" theme="light" />);
    await screen.findByRole("grid");

    await user.type(screen.getByLabelText("Created from"), "2025-05-02");
    await user.type(screen.getByLabelText("Created to"), "2025-05-02");

    await waitFor(() =>
      expect(listApprovals).toHaveBeenLastCalledWith({ createdFrom: "2025-05-01T23:00:00.000Z", createdTo: "2025-05-02T22:59:59.999Z" }, { size: 100 }),
    );
  });
});
