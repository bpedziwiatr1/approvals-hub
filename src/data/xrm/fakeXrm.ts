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
  /** The signed-in user; `timeZoneOffsetMinutes` is added to UTC to get their local time. */
  user?: { id: string; name: string; languageId: number; timeZoneOffsetMinutes: number };
  /** Every request rejects with this error (e.g. a 403 privilege error). */
  failWith?: XrmErrorLike;
}

const AGGREGATE_LIMIT = 50_000;
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

function applySelect(row: Entity, select: string | undefined): Entity {
  if (!select) return { ...row };
  return Object.fromEntries(select.split(",").map((f) => [f, row[f] ?? null]));
}

/**
 * `$apply=[filter(<$filter>)/]groupby((a,b),aggregate($count as alias))`: one row per distinct (a, b) with the number of rows in it.
 * Like Dataverse, an aggregate answers in one page and refuses to aggregate more than 50 000 rows.
 */
function applyAggregate(rows: Entity[], apply: string): Entity[] {
  const match = /^(?:filter\((.*)\)\/)?groupby\(\(([^)]*)\),aggregate\(\$count as (\w+)\)\)$/.exec(apply);
  if (!match) throw new Error(`Unsupported $apply: ${apply}`);
  const [, filter, columns, alias] = match;
  const matching = filter ? rows.filter(compileFilter(filter)) : rows;
  if (matching.length > AGGREGATE_LIMIT) throw { status: 400, message: `The maximum record limit of ${AGGREGATE_LIMIT} for aggregate operations is exceeded.` } satisfies XrmErrorLike;
  const fields = columns.split(",");
  const groups = new Map<string, Entity>();
  for (const row of matching) {
    const group = Object.fromEntries(fields.map((f) => [f, row[f] ?? null]));
    const key = JSON.stringify(group);
    const existing = groups.get(key);
    if (existing) (existing[alias] as number) += 1;
    else groups.set(key, { ...group, [alias]: 1 });
  }
  return [...groups.values()];
}

/** Adds each expanded navigation property of the source row, limited to its own $select. */
function applyExpand(result: Entity, source: Entity, expand: string | undefined): Entity {
  for (const [, nav, select] of (expand ?? "").matchAll(/(\w+)\(\$select=([^)]*)\)/g)) {
    const children = (source[nav] as Entity[] | undefined) ?? [];
    result[nav] = children.map((child) => applySelect(child, select));
  }
  return result;
}

/**
 * In-memory Xrm whose WebApi behaves like Dataverse for the queries the hub sends:
 * $select, $filter (see fakeFilter), $expand of select-only children, $orderby, server paging via odata.maxpagesize and @odata.nextLink ($skiptoken).
 * Each request is recorded as it would reach the Web API (entity set, query options, Prefer header).
 */
export function createFakeXrm(data: FakeXrmData = {}) {
  const user = data.user ?? { id: "{00000000-0000-0000-0000-0000000000F1}", name: "Alex Contoso", languageId: 1033, timeZoneOffsetMinutes: 0 };
  const requests: RecordedRequest[] = [];
  const openedForms: { entityName: string; entityId: string }[] = [];
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
        if (query.$apply) return { entities: applyAggregate(rows, query.$apply) };
        const sorted = applyOrderBy(query.$filter ? rows.filter(compileFilter(query.$filter)) : rows, query.$orderby);
        const start = $skiptoken ? Number($skiptoken) : 0;
        const end = maxPageSize ? start + maxPageSize : sorted.length;
        const entities = sorted.slice(start, end).map((row) => applyExpand(applySelect(row, query.$select), row, query.$expand));
        if (end >= sorted.length) return { entities };
        const next = new URLSearchParams({ ...query, $skiptoken: String(end) });
        return { entities, nextLink: `${BASE_URL}${entitySet}?${next.toString()}` };
      },
    },
    Navigation: {
      async openForm(options) {
        openedForms.push(options);
      },
    },
    Utility: {
      getGlobalContext: () => ({
        getClientUrl: () => "https://contoso.crm.dynamics.com",
        userSettings: {
          userId: user.id,
          userName: user.name,
          languageId: user.languageId,
          getTimeZoneOffsetMinutes: () => user.timeZoneOffsetMinutes,
        },
      }),
    },
  };

  return { xrm, requests, openedForms };
}
