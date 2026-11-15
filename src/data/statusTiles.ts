import type { StatusCounts } from "./dataClient";
import { DISPLAY_STATUSES } from "./displayStatus";

export interface SummaryTiles {
  pending: number;
  approved: number;
  rejected: number;
  /** Completed with another outcome, Cancelled, Expired and Abandoned. */
  other: number;
}

/** The four summary tiles from per-status counts. */
export function toTiles(counts: StatusCounts): SummaryTiles {
  const tiles: SummaryTiles = { pending: 0, approved: 0, rejected: 0, other: 0 };
  for (const { status, tile } of DISPLAY_STATUSES) tiles[tile] += counts[status];
  return tiles;
}
