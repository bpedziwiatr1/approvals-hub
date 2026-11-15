import { compileFilter } from "./fakeFilter";
import { ENTITY_SETS, type ApprovalRow } from "./dataverse";
import type { Entity, XrmErrorLike, XrmLike } from "./xrmTypes";

/** A request as it reaches the Dataverse Web API, recorded for contract tests. */
export interface RecordedRequest {
  entitySet: string;
  params: Record<string, string>;
  prefer: string | null;
}

export interface FakeXrmData {
  approvals?: ApprovalRow[];
  /** Environment variable definitions; `currentValue` is the environment's own value row, if any. */
  environmentVariables?: { schemaName: string; defaultValue?: string; currentValue?: string }[];
  /** Every request rejects with this error (e.g. a 403 privilege error). */
  failWith?: XrmErrorLike;
}

const BASE_URL = "https://contoso.crm.dynamics.com/api/data/v9.2/";

function parseOptions(options: string | undefined): Record<string, string> {
  const params: Record<string, string> = {};
  if (!options) return params;
  for (const [k, v] of new URLSearchParams(options.replace(/^\?/, ""))) params[k] = v;
  return params;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  return (a as string | number) < (b as string | number) ? -1 : 1;
}

function applyOrderBy(rows: Entity[], orderby: string | undefined): Entity[] {
  if (!orderby) return rows;
  const keys = orderby.split(",").map((part) => {
    const [field, dir] = part.trim().split(/\s+/);
    return { field, sign: dir === "desc" ? -1 : 1 };
  });
  return [...rows].sort((a, b) => {
    for (const { field, sign } of keys) {
      const c = compare(a[field], b[field]);
      if (c) return c * sign;
    }
    return 0;
  });
}

function applySelect(row: Entity, select: string | undefined, expand: string | undefined): Entity {
  const selected = select ? Object.fromEntries(select.split(",").map((f) => [f, row[f] ?? null])) : { ...row };
  // $expand: the navigation property named before any "(" is returned as stored, nested $select ignored.
  const navigation = expand?.split("(")[0];
  if (navigation) selected[navigation] = row[navigation] ?? [];
  return selected;
}

/**
 * In-memory Xrm whose WebApi behaves like Dataverse for the queries the hub sends:
 * $select, $filter (see fakeFilter), $orderby, server paging via odata.maxpagesize and @odata.nextLink ($skiptoken).
 * Each request is recorded as it would reach the Web API (entity set, query options, Prefer header).
 */
export function createFakeXrm(data: FakeXrmData = {}) {
  const requests: RecordedRequest[] = [];
  const tables: Record<string, Entity[]> = {
    msdyn_flow_approval: (data.approvals ?? []) as unknown as Entity[],
    environmentvariabledefinition: (data.environmentVariables ?? []).map((v) => ({
      schemaname: v.schemaName,
      defaultvalue: v.defaultValue ?? null,
      environmentvariabledefinition_environmentvariablevalue: v.currentValue === undefined ? [] : [{ value: v.currentValue }],
    })),
  };

  const xrm: XrmLike = {
    WebApi: {
      async retrieveMultipleRecords(entityLogicalName, options, maxPageSize) {
        const entitySet = ENTITY_SETS[entityLogicalName] ?? entityLogicalName;
        const params = parseOptions(options);
        requests.push({ entitySet, params, prefer: maxPageSize ? `odata.maxpagesize=${maxPageSize}` : null });
        if (data.failWith) throw data.failWith;

        const { $skiptoken, ...query } = params;
        const rows = tables[entityLogicalName] ?? [];
        const sorted = applyOrderBy(query.$filter ? rows.filter(compileFilter(query.$filter)) : rows, query.$orderby);
        const start = $skiptoken ? Number($skiptoken) : 0;
        const end = maxPageSize ? start + maxPageSize : sorted.length;
        const entities = sorted.slice(start, end).map((row) => applySelect(row, query.$select, query.$expand));
        if (end >= sorted.length) return { entities };
        const next = new URLSearchParams({ ...query, $skiptoken: String(end) });
        return { entities, nextLink: `${BASE_URL}${entitySet}?${next.toString()}` };
      },
    },
    Utility: {
      getGlobalContext: () => ({
        getClientUrl: () => "https://contoso.crm.dynamics.com",
        userSettings: { userId: "{00000000-0000-0000-0000-0000000000F1}", userName: "Alex Contoso", languageId: 1033 },
      }),
    },
  };

  return { xrm, requests };
}
