import type { DataClient } from "./dataClient";
import { createMockClient } from "./mockClient";
import { isScenarioName, scenarioApprovals } from "./scenarios";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient, findXrm, type HostWindow } from "./xrm/xrmClient";

export type ClientSource = "xrm" | "fakeXrm" | "mock";

/**
 * Picks the DataClient for this page load: `?client=fakeXrm` runs the real xrmClient against an
 * in-memory fake seeded with the scenario; otherwise the hosting app's Xrm; otherwise mockClient.
 */
export function selectClient(search: string, win: HostWindow): { client: DataClient; source: ClientSource } {
  const params = new URLSearchParams(search);
  const requested = params.get("scenario");
  const scenario = isScenarioName(requested) ? requested : "default";

  if (params.get("client") === "fakeXrm") {
    return { client: createXrmClient(createFakeXrm({ approvals: scenarioApprovals(scenario) }).xrm), source: "fakeXrm" };
  }
  const xrm = findXrm(win);
  if (xrm) return { client: createXrmClient(xrm), source: "xrm" };
  return { client: createMockClient(scenario), source: "mock" };
}
