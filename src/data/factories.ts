import type { ApprovalListItem } from "./dataClient";

let counter = 0;

/** Synthetic Approval list item; ids are always 00000000-0000-... GUIDs. */
export function buildApprovalListItem(overrides: Partial<ApprovalListItem> = {}): ApprovalListItem {
  counter += 1;
  return {
    id: `00000000-0000-0000-0000-${String(counter).padStart(12, "0")}`,
    title: `Contoso approval ${counter}`,
    status: "pending",
    outcome: null,
    createdOn: "2025-01-15T09:00:00Z",
    ...overrides,
  };
}
