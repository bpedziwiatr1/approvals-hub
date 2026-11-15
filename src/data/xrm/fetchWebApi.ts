import { ENTITY_SETS } from "./dataverse";
import type { Entity, WebApiLike, XrmErrorLike } from "./xrmTypes";

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/** Dataverse sends error codes as hex strings ("0x80040220"); Xrm.WebApi reports them as signed 32-bit numbers. */
function toErrorCode(code: unknown): number | undefined {
  if (typeof code !== "string" || !/^0x[0-9a-f]+$/i.test(code)) return undefined;
  return parseInt(code, 16) | 0;
}

/**
 * Minimal Xrm.WebApi stand-in over the Dataverse Web API of `clientUrl`, used when only
 * GetGlobalContext() is available. Same-origin requests run as the signed-in user.
 */
export function createFetchWebApi(clientUrl: string, fetch: FetchLike): WebApiLike {
  const base = `${clientUrl.replace(/\/+$/, "")}/api/data/v9.2/`;
  return {
    async retrieveMultipleRecords(entityLogicalName, options = "", maxPageSize) {
      const entitySet = ENTITY_SETS[entityLogicalName] ?? `${entityLogicalName}s`;
      const headers: Record<string, string> = { Accept: "application/json", "OData-MaxVersion": "4.0", "OData-Version": "4.0" };
      if (maxPageSize) headers.Prefer = `odata.maxpagesize=${maxPageSize}`;
      const response = await fetch(`${base}${entitySet}${options}`, { method: "GET", credentials: "same-origin", headers });
      const body = (await response.json().catch(() => ({}))) as { value?: Entity[]; "@odata.nextLink"?: string; error?: { code?: unknown; message?: string } };
      if (!response.ok) {
        const error: XrmErrorLike = { status: response.status, errorCode: toErrorCode(body.error?.code), message: body.error?.message ?? response.statusText };
        throw error;
      }
      const nextLink = body["@odata.nextLink"];
      return nextLink ? { entities: body.value ?? [], nextLink } : { entities: body.value ?? [] };
    },
  };
}
