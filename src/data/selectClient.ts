import type { DataClient, RecordRef } from "./dataClient";
import { createMockClient } from "./mockClient";
import { isScenarioName, scenarioApprovals } from "./scenarios";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient, findXrm, type HostWindow } from "./xrm/xrmClient";

export type ClientSource = "xrm" | "fakeXrm" | "mock";

/**
 * Picks the DataClient for this page load: `?client=fakeXrm` runs the real xrmClient against an
 * in-memory fake seeded with the scenario (`openedRecords` reads back the records opened, for e2e tests of the local clients); otherwise the hosting app's Xrm; otherwise mockClient.
 */
export function selectClient(search: string, win: HostWindow): { client: DataClient; source: ClientSource; openedRecords: (() => RecordRef[]) | null } {
  const params = new URLSearchParams(search);
  const requested = params.get("scenario");
  const scenario = isScenarioName(requested) ? requested : "default";

  if (params.get("client") === "fakeXrm") {
    const fake = createFakeXrm({ approvals: scenarioApprovals(scenario) });
    return { client: createXrmClient(fake.xrm), source: "fakeXrm", openedRecords: () => fake.openedForms };
  }
  const xrm = findXrm(win);
  if (xrm) return { client: createXrmClient(xrm), source: "xrm", openedRecords: null };
  const mock = createMockClient(scenario);
  return { client: mock, source: "mock", openedRecords: () => mock.openedRecords };
}
