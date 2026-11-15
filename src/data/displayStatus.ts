import type { ApprovalStatus } from "./dataClient";
import { APPROVAL_STATUSCODE as CODE } from "./xrm/dataverse";

/** Result texts Power Automate writes for the two outcomes the hub shows as Approved and Rejected; any other text is a custom outcome. */
export const APPROVE_RESULTS = ["Approve", "Approved"] as const;
export const REJECT_RESULTS = ["Reject", "Rejected"] as const;

export type SummaryTile = "pending" | "approved" | "rejected" | "other";

/**
 * How a Display Status is stored: the statuscodes it covers and, for completed Approvals, which result texts it covers
 * (`other`: every result that is neither Approve/Approved nor Reject/Rejected, including no result).
 * The one table that deriveStatus (stored to display), statusCondition (display to $filter) and the summary tiles read.
 */
export const DISPLAY_STATUSES: readonly {
  status: ApprovalStatus;
  tile: SummaryTile;
  statuscodes: readonly number[];
  results?: readonly string[] | "other";
}[] = [
  { status: "pending", tile: "pending", statuscodes: [CODE.created, CODE.pending, CODE.suspended] },
  { status: "approved", tile: "approved", statuscodes: [CODE.completed], results: APPROVE_RESULTS },
  { status: "rejected", tile: "rejected", statuscodes: [CODE.completed], results: REJECT_RESULTS },
  { status: "completed", tile: "other", statuscodes: [CODE.completed], results: "other" },
  { status: "cancelled", tile: "other", statuscodes: [CODE.cancelled] },
  { status: "expired", tile: "other", statuscodes: [CODE.expired] },
  { status: "abandoned", tile: "other", statuscodes: [CODE.abandoned] },
];

/** Display Statuses in the order the UI lists them. */
export const DISPLAY_STATUS_ORDER: readonly ApprovalStatus[] = DISPLAY_STATUSES.map((s) => s.status);

export const isDisplayStatus = (value: string): value is ApprovalStatus => (DISPLAY_STATUS_ORDER as readonly string[]).includes(value);
