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

export type TitleMatchMode = "equals" | "startsWith" | "contains";

/** The fixed filter of a Profile; every criterion that is set must match. Applied to every query, never part of the URL. */
export interface ProfileScope {
  title?: { mode: TitleMatchMode; value: string };
  category?: string;
  /** Matched with `contains` against the Approval's tags. */
  tags?: string;
}

export interface ApprovalQuery {
  scope?: ProfileScope;
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

export interface Approver {
  id: string;
  name: string;
}

/** One Approver's decision on an Approval; `response` is the option text as stored (custom options included). */
export interface ApprovalResponse {
  approver: Approver;
  response: string;
  comments: string | null;
  /** ISO 8601, UTC. */
  respondedOn: string;
}

export interface ApprovalStepDetail {
  /** Step number; 0 for the implicit single step of an Approval without step rows. */
  number: number;
  /** True when no Approval Step row exists and the step is synthesised. */
  implicit: boolean;
  stage: string | null;
  result: string | null;
  responses: ApprovalResponse[];
  /** Approvers with an active Approval Request in this step who have not responded yet. */
  pendingApprovers: Approver[];
  /** Approvers whose Approval Request was reassigned to someone else. */
  reassignedApprovers: Approver[];
}

export interface ApprovalDetail extends ApprovalListItem {
  /** Markdown, as written by the flow. */
  details: string;
  steps: ApprovalStepDetail[];
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
