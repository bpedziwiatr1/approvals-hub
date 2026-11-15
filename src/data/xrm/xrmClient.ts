import { DataError, emptyStatusCounts, type DataClient } from "../dataClient";
import { APPROVAL, ENVIRONMENT_VARIABLE as ENV_VAR } from "./dataverse";
import { toDataError } from "./errors";
import { mapApprovalDetail, mapApprovalListItem } from "./mappers";
import { buildCountOptions, buildDetailOptions, buildListOptions, GUID } from "./odataQuery";
import type { ApprovalRow } from "./dataverse";
import { createFetchWebApi, type FetchLike } from "./fetchWebApi";
import type { Entity, GlobalContextLike, RetrieveMultipleResult, XrmLike } from "./xrmTypes";

/** The parts of `window` where a model-driven app exposes its client API. */
export interface HostWindow {
  parent?: HostWindow;
  Xrm?: XrmLike;
  GetGlobalContext?: () => GlobalContextLike;
  fetch?: FetchLike;
}

/**
 * The one place that touches the Xrm global: `window.parent.Xrm` of the hosting model-driven app,
 * else `GetGlobalContext()` (ClientGlobalContext.js.aspx) with the Web API of its client URL; null when neither exists.
 */
export function findXrm(win: HostWindow): XrmLike | null {
  try {
    const parentXrm = win.parent?.Xrm;
    if (parentXrm?.WebApi) return parentXrm;
  } catch {
    // Cross-origin parent: not hosted in a model-driven app.
  }
  if (typeof win.GetGlobalContext === "function" && typeof win.fetch === "function") {
    const context = win.GetGlobalContext();
    return {
      // Called as a method of win: an unbound window.fetch throws "Illegal invocation".
      WebApi: createFetchWebApi(context.getClientUrl(), (url, init) => win.fetch!(url, init)),
      Utility: { getGlobalContext: () => context },
    };
  }
  return null;
}

function nextPageOptions(nextLink: string | undefined): string | null {
  if (!nextLink) return null;
  const q = nextLink.indexOf("?");
  return q >= 0 ? nextLink.slice(q) : null;
}

/** Largest page Dataverse returns; counts and exports read every matching row in pages of this size. */
const MAX_PAGE_SIZE = 5000;

const notYet = (what: string) => Promise.reject(new DataError("server", `${what} is not available yet`));

/** DataClient backed by the model-driven app's Xrm.WebApi, running as the signed-in user. */
export function createXrmClient(xrm: XrmLike): DataClient {
  const retrieve = async (logicalName: string, options: string, pageSize: number): Promise<RetrieveMultipleResult> => {
    try {
      return await xrm.WebApi.retrieveMultipleRecords(logicalName, options, pageSize);
    } catch (error) {
      throw toDataError(error);
    }
  };

  const currentUserId = () => {
    const id = xrm.Utility?.getGlobalContext().userSettings.userId;
    if (!id) throw new DataError("server", "The current user is not available");
    return id;
  };

  /** Every row matching the query options, one server page after another. */
  async function* everyRow(options: string): AsyncGenerator<Entity> {
    let next: string | null = options;
    while (next !== null) {
      const result: RetrieveMultipleResult = await retrieve(APPROVAL.logicalName, next, MAX_PAGE_SIZE);
      yield* result.entities;
      next = nextPageOptions(result.nextLink);
    }
  }

  return {
    async listApprovals(query, page) {
      // The continuation token is the query part of @odata.nextLink, which Xrm.WebApi takes back as options.
      const options = page.continuationToken ?? buildListOptions(query, query.assignedToMe ? currentUserId() : undefined);
      const result = await retrieve(APPROVAL.logicalName, options, page.size);
      return { items: result.entities.map(mapApprovalListItem), continuationToken: nextPageOptions(result.nextLink) };
    },
    async countByStatus(query) {
      const counts = emptyStatusCounts();
      for await (const row of everyRow(buildCountOptions(query, query.assignedToMe ? currentUserId() : undefined))) counts[mapApprovalListItem(row).status] += 1;
      return counts;
    },
    async getApprovalDetail(approvalId) {
      if (!GUID.test(approvalId)) throw new DataError("notFound", `Approval ${approvalId} not found`);
      const result = await retrieve(APPROVAL.logicalName, buildDetailOptions(approvalId), 1);
      if (result.entities.length === 0) throw new DataError("notFound", `Approval ${approvalId} not found`);
      return mapApprovalDetail(result.entities[0] as unknown as ApprovalRow);
    },
    async *exportApprovals(query) {
      for await (const row of everyRow(buildListOptions(query, query.assignedToMe ? currentUserId() : undefined))) yield mapApprovalListItem(row);
    },
    getCurrentUser: () => notYet("getCurrentUser"),
    async loadConfigValue(schemaName) {
      const filter = `${ENV_VAR.schemaName} eq '${schemaName.replace(/'/g, "''")}'`;
      const expand = `${ENV_VAR.valuesNavigation}($select=value)`;
      const options = `?$select=${ENV_VAR.defaultValue}&$filter=${encodeURIComponent(filter)}&$expand=${encodeURIComponent(expand)}`;
      const { entities } = await retrieve(ENV_VAR.logicalName, options, 1);
      const definition = entities[0];
      if (!definition) return null;
      const values = definition[ENV_VAR.valuesNavigation] as { value?: string | null }[] | undefined;
      return values?.[0]?.value ?? (definition[ENV_VAR.defaultValue] as string | null | undefined) ?? null;
    },
    async openRecord(record) {
      if (!xrm.Navigation) throw new DataError("server", "Xrm.Navigation is not available outside a model-driven app");
      await xrm.Navigation.openForm({ entityName: record.entityName, entityId: record.entityId });
    },
  };
}
