/** Display status of an Approval; derived from statuscode and result, never stored. */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "completed" | "cancelled" | "expired" | "abandoned";

export interface ApprovalListItem {
  id: string;
  title: string;
  status: ApprovalStatus;
  /** Outcome text for status "completed" (any result other than approve/reject). */
  outcome: string | null;
  /** ISO 8601, UTC. */
  createdOn: string;
}

export type SortField = "title" | "status" | "createdOn";

export interface ApprovalQuery {
  title?: string;
  statuses?: ApprovalStatus[];
  createdFrom?: string;
  createdTo?: string;
  approverId?: string;
  ownerId?: string;
  assignedToMe?: { pendingOnly: boolean };
  sort?: { field: SortField; descending: boolean };
}

export interface PageRequest {
  size: number;
  continuationToken?: string | null;
}

export interface ApprovalPage {
  items: ApprovalListItem[];
  continuationToken: string | null;
}

export type StatusCounts = Record<ApprovalStatus, number>;

export interface ApprovalDetail extends ApprovalListItem {
  details: string;
}

export interface CurrentUser {
  id: string;
  name: string;
  languageId: number;
}

export interface RecordRef {
  entityName: string;
  entityId: string;
}

export type DataErrorKind = "forbidden" | "notFound" | "server";

export class DataError extends Error {
  readonly kind: DataErrorKind;
  constructor(kind: DataErrorKind, message: string) {
    super(message);
    this.name = "DataError";
    this.kind = kind;
  }
}

/** The only way the UI reaches data. No OData concepts leak through it. */
export interface DataClient {
  listApprovals(query: ApprovalQuery, page: PageRequest): Promise<ApprovalPage>;
  countByStatus(query: ApprovalQuery): Promise<StatusCounts>;
  getApprovalDetail(approvalId: string): Promise<ApprovalDetail>;
  exportApprovals(query: ApprovalQuery): AsyncIterable<ApprovalListItem>;
  getCurrentUser(): Promise<CurrentUser>;
  /** Raw JSON of the environment variable: current value, else default value; null when absent. */
  loadConfigValue(schemaName: string): Promise<string | null>;
  openRecord(record: RecordRef): Promise<void>;
}

export function emptyStatusCounts(): StatusCounts {
  return { pending: 0, approved: 0, rejected: 0, completed: 0, cancelled: 0, expired: 0, abandoned: 0 };
}
