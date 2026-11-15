import { describe, expect, it } from "vitest";
import { DataError, type DataClient } from "./dataClient";
import { createMockClient } from "./mockClient";
import { createFakeXrm } from "./xrm/fakeXrm";
import { createXrmClient } from "./xrm/xrmClient";

const USER = { id: "{00000000-0000-0000-0000-0000000000F1}", name: "Alex Contoso", languageId: 1045, timeZoneOffsetMinutes: 60 };

const clients = (): [string, DataClient][] => [
  ["mockClient", createMockClient("default")],
  ["xrmClient", createXrmClient(createFakeXrm({ user: USER }).xrm)],
];

describe.each(clients())("%s getCurrentUser", (_name, client) => {
  it("gives the id (bare, lower case), name, language id and UTC offset of the signed-in user", async () => {
    const user = await client.getCurrentUser();
    expect(user).toMatchObject({ id: "00000000-0000-0000-0000-0000000000f1", name: "Alex Contoso" });
    expect(typeof user.languageId).toBe("number");
    expect(Number.isInteger(user.timeZoneOffsetMinutes)).toBe(true);
  });
});

describe("xrmClient getCurrentUser", () => {
  it("reads language and time zone from the user settings", async () => {
    const client = createXrmClient(createFakeXrm({ user: USER }).xrm);
    expect(await client.getCurrentUser()).toEqual({ id: "00000000-0000-0000-0000-0000000000f1", name: "Alex Contoso", languageId: 1045, timeZoneOffsetMinutes: 60 });
  });

  it("fails as a data error outside a model-driven app", async () => {
    const { xrm } = createFakeXrm();
    const client = createXrmClient({ WebApi: xrm.WebApi });
    await expect(client.getCurrentUser()).rejects.toBeInstanceOf(DataError);
  });
});
