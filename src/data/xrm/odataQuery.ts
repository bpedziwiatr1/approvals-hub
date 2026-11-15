import type { ApprovalQuery, SortField } from "../dataClient";
import { APPROVAL } from "./dataverse";

const LIST_SELECT = [APPROVAL.id, APPROVAL.title, APPROVAL.result, APPROVAL.statuscode, APPROVAL.createdOn];

const SORT_COLUMNS: Record<SortField, string> = {
  title: APPROVAL.title,
  status: APPROVAL.statuscode,
  createdOn: APPROVAL.createdOn,
};

/** Query options (`?$select=...&$orderby=...`) for the first page of the Approvals list. */
export function buildListOptions(query: ApprovalQuery): string {
  const sort = query.sort ?? { field: "createdOn", descending: true };
  const params = [`$select=${LIST_SELECT.join(",")}`, `$orderby=${SORT_COLUMNS[sort.field]} ${sort.descending ? "desc" : "asc"}`];
  return `?${params.join("&")}`;
}
