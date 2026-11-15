import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

function setNarrow(narrow: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: narrow,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("narrow layout", () => {
  it("shows the detail pane beside the list on a wide screen", async () => {
    setNarrow(false);
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await userEvent.click(await screen.findByText("Contoso purchase order 1001"));
    expect(await screen.findByRole("heading", { name: "Contoso purchase order 1001" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the detail pane as a drawer on a narrow screen and closes it again", async () => {
    setNarrow(true);
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(await screen.findByText("Contoso purchase order 1001"));
    const drawer = await screen.findByRole("dialog", { name: "Approval details" });
    expect(await within(drawer).findByRole("heading", { name: "Contoso purchase order 1001" })).toBeInTheDocument();
    await userEvent.click(within(drawer).getByRole("button", { name: "Close" }));
    await vi.waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("accessibility", () => {
  it("list, detail and failure states have no axe violations", async () => {
    setNarrow(false);
    const { container, unmount } = render(<App client={createMockClient("multiStep")} lang="en" theme="light" />);
    await userEvent.click(await screen.findByText("Contoso budget approval"));
    await screen.findByRole("heading", { name: "Contoso budget approval" });
    expect(await axe(container)).toHaveNoViolations();
    unmount();

    for (const scenario of ["empty", "noPermission"] as const) {
      const view = render(<App client={createMockClient(scenario)} lang="en" theme="dark" />);
      await vi.waitFor(() => expect(view.container.querySelector("p")).not.toBeNull());
      expect(await axe(view.container)).toHaveNoViolations();
      view.unmount();
    }
  });

  it("selects a row with the keyboard alone", async () => {
    setNarrow(false);
    render(<App client={createMockClient("default")} lang="en" theme="light" />);
    await screen.findByRole("grid");
    screen.getByRole("row", { name: /purchase order 1001/ }).focus();
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByRole("heading", { level: 2 })).toBeInTheDocument();
  });
});
