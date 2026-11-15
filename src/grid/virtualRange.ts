export interface VirtualRangeInput {
  scrollTop: number;
  viewportHeight: number;
  rowHeight: number;
  count: number;
  overscan: number;
}

/** Rows [start, end) to render for a fixed row height, plus overscan on both sides. */
export function visibleRange({ scrollTop, viewportHeight, rowHeight, count, overscan }: VirtualRangeInput): { start: number; end: number } {
  const visible = Math.ceil(viewportHeight / rowHeight);
  const first = Math.min(Math.max(0, Math.floor(scrollTop / rowHeight)), Math.max(0, count - visible));
  return { start: Math.max(0, first - overscan), end: Math.min(count, first + visible + overscan) };
}
