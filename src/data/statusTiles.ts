import type { StatusCounts } from "./dataClient";

export interface SummaryTiles {
  pending: number;
  approved: number;
  rejected: number;
  /** Completed with another outcome, Cancelled, Expired and Abandoned. */
  other: number;
}

/** The four summary tiles from per-status counts. */
export function toTiles(counts: StatusCounts): SummaryTiles {
  return {
    pending: counts.pending,
    approved: counts.approved,
    rejected: counts.rejected,
    other: counts.completed + counts.cancelled + counts.expired + counts.abandoned,
  };
}
