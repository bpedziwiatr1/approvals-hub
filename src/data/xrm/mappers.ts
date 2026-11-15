import type { ApprovalListItem, ApprovalStatus } from "../dataClient";
import { APPROVAL, APPROVAL_STATUSCODE } from "./dataverse";
import type { Entity } from "./xrmTypes";

const APPROVED = new Set(["approve", "approved"]);
const REJECTED = new Set(["reject", "rejected"]);

/**
 * Display status from the stored statuscode and result text. Created and Suspended show as Pending;
 * an unknown statuscode also shows as Pending so the Approval stays visible.
 */
export function deriveStatus(statuscode: number, result: string | null): { status: ApprovalStatus; outcome: string | null } {
  switch (statuscode) {
    case APPROVAL_STATUSCODE.completed: {
      const normalised = result?.trim().toLowerCase() ?? "";
      if (APPROVED.has(normalised)) return { status: "approved", outcome: null };
      if (REJECTED.has(normalised)) return { status: "rejected", outcome: null };
      return { status: "completed", outcome: result?.trim() || null };
    }
    case APPROVAL_STATUSCODE.expired:
      return { status: "expired", outcome: null };
    case APPROVAL_STATUSCODE.cancelled:
      return { status: "cancelled", outcome: null };
    case APPROVAL_STATUSCODE.abandoned:
      return { status: "abandoned", outcome: null };
    default:
      return { status: "pending", outcome: null };
  }
}

const text = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** One msdyn_flow_approval row (list columns) to an Approval list item. */
export function mapApprovalListItem(row: Entity): ApprovalListItem {
  const { status, outcome } = deriveStatus(Number(row[APPROVAL.statuscode]), text(row[APPROVAL.result]));
  return {
    id: String(row[APPROVAL.id]),
    title: text(row[APPROVAL.title]) ?? "",
    status,
    outcome,
    createdOn: String(row[APPROVAL.createdOn]),
  };
}
