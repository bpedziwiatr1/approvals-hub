import { DataError, emptyStatusCounts, type ApprovalQuery, type SortField, type DataClient, type ProfileScope, type RecordRef, type StatusCounts } from "./dataClient";
import { CURRENT_USER_ID, MOCK_CONFIG_JSON, scenarioApprovals, type ScenarioName } from "./scenarios";
import type { ApprovalRow } from "./xrm/dataverse";
import { mapApprovalDetail, mapApprovalListItem } from "./xrm/mappers";

export { isScenarioName, type ScenarioName } from "./scenarios";

const SLOW_DELAY_MS = 1500;
const sameId = (a: string | undefined, b: string) => a?.toLowerCase() === b.toLowerCase();
const ACTIVE = 0;

/** In-memory DataClient for local development and UI tests; pages through continuation tokens like Dataverse. */
export type MockClient = DataClient & { /** Calls of openRecord, in order. */ openedRecords: RecordRef[] };

export function createMockClient(scenario: ScenarioName): MockClient {
  const openedRecords: RecordRef[] = [];
  const rows = scenarioApprovals(scenario);
  const all = rows.map((row) => ({ item: mapApprovalListItem({ ...row }), row }));
  const hasRequest = (row: ApprovalRow, userId: string, activeOnly: boolean) =>
    (row.msdyn_flow_approvalrelationship_approvalrequests ?? []).some((r) => sameId(r._ownerid_value, userId) && (!activeOnly || r.statecode === ACTIVE));
  const inScope = (row: ApprovalRow, scope: ProfileScope | undefined) => {
    if (!scope) return true;
    const title = row.msdyn_flow_approval_title.toLowerCase();
    const wanted = scope.title?.value.toLowerCase() ?? "";
    const titleOk =
      !scope.title ||
      (scope.title.mode === "equals" ? title === wanted : scope.title.mode === "startsWith" ? title.startsWith(wanted) : title.includes(wanted));
    return (
      titleOk &&
      (!scope.category || row.msdyn_flow_approval_category?.toLowerCase() === scope.category.toLowerCase()) &&
      (!scope.tags || (row.msdyn_flow_approval_tags ?? "").toLowerCase().includes(scope.tags.toLowerCase()))
    );
  };
  // Sort keys as the server orders them: title, stored status code, created on, owner id, current step (no step first).
  const sortKey = ({ item, row }: (typeof all)[number], field: SortField): string | number =>
    ({
      title: item.title.toLowerCase(),
      status: row.statuscode,
      createdOn: Date.parse(item.createdOn),
      owner: row._ownerid_value ?? "",
      currentStep: row.msdyn_flow_approval_currentstepnumber ?? -1,
    })[field];
  const sorted = (entries: typeof all, sort: ApprovalQuery["sort"]) => {
    if (!sort) return entries;
    const sign = sort.descending ? -1 : 1;
    return [...entries].sort((a, b) => {
      const [x, y] = [sortKey(a, sort.field), sortKey(b, sort.field)];
      return x === y ? Date.parse(b.item.createdOn) - Date.parse(a.item.createdOn) : (x < y ? -1 : 1) * sign;
    });
  };
  const matching = (query: ApprovalQuery) =>
    sorted(all, query.sort)
      .filter(
        ({ item: i, row }) =>
          inScope(row, query.scope) &&
          (!query.title || i.title.toLowerCase().includes(query.title.toLowerCase())) &&
          (!query.statuses?.length || query.statuses.includes(i.status)) &&
          (!query.ownerId || sameId(row._ownerid_value, query.ownerId)) &&
          (!query.approverId || hasRequest(row, query.approverId, false)) &&
          (!query.assignedToMe || hasRequest(row, CURRENT_USER_ID, query.assignedToMe.pendingOnly)) &&
          (!query.createdFrom || Date.parse(i.createdOn) >= Date.parse(query.createdFrom)) &&
          (!query.createdTo || Date.parse(i.createdOn) <= Date.parse(query.createdTo)),
      )
      .map(({ item }) => item);

  // Failure-mode scenarios: noPermission always refuses, serverError fails the first list call only (so Retry recovers), slow answers late.
  // Calls made in the same tick (React StrictMode mounts effects twice in dev) count as one attempt.
  let attempts = 0;
  let sameTick = false;
  return {
    async listApprovals(query, page) {
      if (!sameTick) attempts += 1;
      sameTick = true;
      setTimeout(() => (sameTick = false), 0);
      if (scenario === "noPermission") throw new DataError("forbidden", "Access is denied");
      if (scenario === "serverError" && attempts === 1) throw new DataError("server", "Internal server error");
      if (scenario === "slow") await new Promise((resolve) => setTimeout(resolve, SLOW_DELAY_MS));
      const start = page.continuationToken ? Number(page.continuationToken) : 0;
      const items = matching(query);
      const end = start + page.size;
      return { items: items.slice(start, end), continuationToken: end < items.length ? String(end) : null };
    },
    async countByStatus(query) {
      const counts: StatusCounts = emptyStatusCounts();
      for (const i of matching(query)) counts[i.status] += 1;
      return counts;
    },
    async getApprovalDetail(approvalId) {
      const row = rows.find((r) => r.msdyn_flow_approvalid === approvalId);
      if (!row) throw new DataError("notFound", `Approval ${approvalId} not found`);
      return mapApprovalDetail(row);
    },
    async *exportApprovals(query) {
      yield* matching(query);
    },
    async getCurrentUser() {
      return { id: CURRENT_USER_ID, name: "Alex Contoso", languageId: 1033, timeZoneOffsetMinutes: 0 };
    },
    async loadConfigValue() {
      return MOCK_CONFIG_JSON;
    },
    openedRecords,
    async openRecord(record) {
      openedRecords.push(record);
    },
  };
}
