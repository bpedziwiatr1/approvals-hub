import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";
import { createMockClient } from "./data/mockClient";

describe("failure modes of the list", () => {
  it("empty scenario shows the empty state", async () => {
    render(<App client={createMockClient("empty")} lang="en" theme="light" />);
    expect(await screen.findByText("No approvals found")).toBeInTheDocument();
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("noPermission scenario explains the missing permission and offers no retry", async () => {
    render(<App client={createMockClient("noPermission")} lang="en" theme="light" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You do not have permission to read approvals");
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("serverError scenario shows an error and Retry recovers", async () => {
    render(<App client={createMockClient("serverError")} lang="en" theme="light" />);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Could not load approvals");
    await userEvent.click(within(alert).getByRole("button", { name: "Retry" }));
    const grid = await screen.findByRole("grid");
    expect(within(grid).getByText("Contoso purchase order 1001")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("slow scenario shows the loading state until the list arrives", async () => {
    render(<App client={createMockClient("slow")} lang="en" theme="light" />);
    await screen.findByRole("heading", { name: "Approvals Hub" });
    expect(screen.getByText("Loading approvals")).toBeInTheDocument();
    expect(await screen.findByRole("grid", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText("Loading approvals")).not.toBeInTheDocument();
  });

  it("states are translated to Polish", async () => {
    render(<App client={createMockClient("noPermission")} lang="pl" theme="light" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak uprawnień do odczytu zatwierdzeń");
  });
});
