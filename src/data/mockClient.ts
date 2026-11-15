import { DataError, type ApprovalQuery, type DataClient, type ProfileScope, type RecordRef, type StatusCounts } from "./dataClient";
import { CURRENT_USER_ID, MOCK_CONFIG_JSON, scenarioApprovals, type ScenarioName } from "./scenarios";
import type { ApprovalRow } from "./xrm/dataverse";
import { mapApprovalDetail, mapApprovalListItem } from "./xrm/mappers";

export { isScenarioName, type ScenarioName } from "./scenarios";

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
  const matching = (query: ApprovalQuery) =>
    all
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

  return {
    async listApprovals(query, page) {
      const start = page.continuationToken ? Number(page.continuationToken) : 0;
      const items = matching(query);
      const end = start + page.size;
      return { items: items.slice(start, end), continuationToken: end < items.length ? String(end) : null };
    },
    async countByStatus(query) {
      const counts: StatusCounts = { pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 };
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
      return { id: CURRENT_USER_ID, name: "Alex Contoso", languageId: 1033 };
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
