import { describe, expect, it, vi } from "vitest";
import { createFakeXrm } from "./fakeXrm";
import { findXrm, type HostWindow } from "./xrmClient";

const globalContext = {
  getClientUrl: () => "https://contoso.crm.dynamics.com",
  userSettings: { userId: "{00000000-0000-0000-0000-0000000000F1}", userName: "Alex Contoso", languageId: 1033 },
};

describe("findXrm", () => {
  it("uses Xrm from the parent window of the model-driven app", () => {
    const { xrm } = createFakeXrm();
    const win: HostWindow = { parent: { Xrm: xrm } as HostWindow };
    expect(findXrm(win)).toBe(xrm);
  });

  it("returns null when neither the parent Xrm nor GetGlobalContext is available", () => {
    expect(findXrm({ parent: {} as HostWindow })).toBeNull();
  });

  it("returns null when the parent window is cross-origin and no GetGlobalContext exists", () => {
    const win = {} as HostWindow;
    Object.defineProperty(win, "parent", {
      get() {
        throw new DOMException("Blocked a frame", "SecurityError");
      },
    });
    expect(findXrm(win)).toBeNull();
  });

  it("falls back to GetGlobalContext and reads through the Web API of its client URL as the signed-in user", async () => {
    const fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          value: [{ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000c001" }],
          "@odata.nextLink": "https://contoso.crm.dynamics.com/api/data/v9.2/msdyn_flow_approvals?$skiptoken=x",
        }),
        { status: 200 },
      ),
    );
    const xrm = findXrm({ parent: {} as HostWindow, GetGlobalContext: () => globalContext, fetch });

    const result = await xrm!.WebApi.retrieveMultipleRecords("msdyn_flow_approval", "?$select=msdyn_flow_approvalid", 50);

    expect(result).toEqual({
      entities: [{ msdyn_flow_approvalid: "00000000-0000-0000-0000-00000000c001" }],
      nextLink: "https://contoso.crm.dynamics.com/api/data/v9.2/msdyn_flow_approvals?$skiptoken=x",
    });
    expect(fetch).toHaveBeenCalledWith("https://contoso.crm.dynamics.com/api/data/v9.2/msdyn_flow_approvals?$select=msdyn_flow_approvalid", {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        Prefer: "odata.maxpagesize=50",
      },
    });
    expect(xrm!.Utility!.getGlobalContext()).toBe(globalContext);
  });

  it("rejects with the HTTP status and Dataverse error of a failed fallback request", async () => {
    const fetch = vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "0x80040220", message: "Principal user is missing prvReadmsdyn_flow_approval privilege" } }), {
        status: 403,
      }),
    );
    const xrm = findXrm({ parent: {} as HostWindow, GetGlobalContext: () => globalContext, fetch });

    await expect(xrm!.WebApi.retrieveMultipleRecords("msdyn_flow_approval", "?$select=msdyn_flow_approvalid", 50)).rejects.toEqual({
      status: 403,
      errorCode: -2147220960,
      message: "Principal user is missing prvReadmsdyn_flow_approval privilege",
    });
  });
});
