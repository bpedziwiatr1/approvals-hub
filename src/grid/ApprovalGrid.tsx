import {
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  TableCellLayout,
  createTableColumn,
  makeStyles,
  mergeClasses,
  tokens,
  type DataGridProps,
  type TableColumnDefinition,
  type TableColumnSizingOptions,
} from "@fluentui/react-components";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode, type UIEvent } from "react";
import { useTranslation } from "react-i18next";
import type { ColumnId } from "../config/profileConfig";
import type { ApprovalListItem, ApprovalQuery, SortField } from "../data/dataClient";
import { StatusBadge } from "../StatusBadge";
import { useUserTime } from "../time/userTimeContext";
import { visibleRange } from "./virtualRange";

const ROW_HEIGHT = 44;
const OVERSCAN = 10;
/** Used until the scroll container has been laid out (and in jsdom, which has no layout). */
const FALLBACK_VIEWPORT_HEIGHT = 800;

const useStyles = makeStyles({
  scroller: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  header: { position: "sticky", top: 0, zIndex: 1, backgroundColor: tokens.colorNeutralBackground1 },
  row: { height: `${ROW_HEIGHT}px`, minHeight: `${ROW_HEIGHT}px`, cursor: "pointer" },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
});

/** Columns the server can sort by; the others (last decision) come from child rows. */
const SORT_FIELDS: Partial<Record<ColumnId, SortField>> = {
  title: "title",
  status: "status",
  createdOn: "createdOn",
  owner: "owner",
  currentStep: "currentStep",
};

const SIZES: TableColumnSizingOptions = {
  title: { minWidth: 160, defaultWidth: 320, idealWidth: 320 },
  status: { minWidth: 110, defaultWidth: 140, idealWidth: 140 },
  createdOn: { minWidth: 140, defaultWidth: 180, idealWidth: 180 },
  owner: { minWidth: 120, defaultWidth: 160, idealWidth: 160 },
  currentStep: { minWidth: 90, defaultWidth: 110, idealWidth: 110 },
  lastDecision: { minWidth: 160, defaultWidth: 260, idealWidth: 260 },
};

export interface ApprovalGridProps {
  items: ApprovalListItem[];
  /** More pages exist on the server, so the total row count is unknown. */
  hasMore: boolean;
  columns: ColumnId[];
  sort: ApprovalQuery["sort"];
  onSortChange: (sort: NonNullable<ApprovalQuery["sort"]>) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Called when the rendered window reaches the end of the loaded items. */
  onNearEnd: () => void;
  /** Rendered below the rows inside the scroll area (loading and error notes). */
  footer?: ReactNode;
}

/**
 * Fluent DataGrid with server-side sort, resizable columns and single selection. Only the rows in view are rendered:
 * the grid is given that window of the loaded items and the rows outside it are stood in for by padding.
 */
export function ApprovalGrid({ items, hasMore, columns, sort, onSortChange, selectedId, onSelect, onNearEnd, footer }: ApprovalGridProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { format: formatDate } = useUserTime();
  // Only one row is a tab stop (roving tabindex): the focused one, else the selected one, else the first.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [scroll, setScroll] = useState({ top: 0, height: FALLBACK_VIEWPORT_HEIGHT });

  const count = items.length;
  const { start, end } = visibleRange({ scrollTop: scroll.top, viewportHeight: scroll.height, rowHeight: ROW_HEIGHT, count, overscan: OVERSCAN });
  const windowed = useMemo(() => items.slice(start, end), [items, start, end]);
  const tabStopId = [focusedId, selectedId].find((id) => id !== null && windowed.some((i) => i.id === id)) ?? windowed[0]?.id;

  // Ask for the next server page once the rendered window reaches the end of what is loaded.
  useEffect(() => {
    if (count > 0 && end >= count - OVERSCAN) onNearEnd();
  }, [count, end, onNearEnd]);

  const defs = useMemo<TableColumnDefinition<ApprovalListItem>[]>(
    () =>
      columns.map((id) =>
        createTableColumn<ApprovalListItem>({
          columnId: id,
          // The server sorts. Fluent treats a column as sortable when its comparer takes arguments, so this one takes two and never reorders.
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          ...(SORT_FIELDS[id] ? { compare: (_a: ApprovalListItem, _b: ApprovalListItem) => 0 } : {}),
          renderHeaderCell: () => t(`list.column.${id}`),
          renderCell: (item) => renderCell(id, item, formatDate),
        }),
      ),
    [columns, t, formatDate],
  );

  const sortState = { sortColumn: sort?.field ?? "createdOn", sortDirection: (sort ? sort.descending : true) ? "descending" : "ascending" } as const;
  const onSort: DataGridProps["onSortChange"] = (_, next) => {
    const field = SORT_FIELDS[next.sortColumn as ColumnId];
    if (field) onSortChange({ field, descending: next.sortDirection === "descending" });
  };

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScroll({ top: el.scrollTop, height: el.clientHeight || FALLBACK_VIEWPORT_HEIGHT });
  };

  return (
    <div role="region" aria-label={t("list.region")} className={styles.scroller} onScroll={onScroll}>
      <DataGrid
        items={windowed}
        columns={defs}
        getRowId={(item) => item.id}
        aria-label={t("app.title")}
        aria-rowcount={hasMore ? -1 : count + 1}
        sortable
        sortState={sortState}
        onSortChange={onSort}
        resizableColumns
        columnSizingOptions={SIZES}
        selectionMode="single"
        selectedItems={selectedId ? [selectedId] : []}
        onSelectionChange={(_, data) => {
          const [id] = [...data.selectedItems];
          if (typeof id === "string") onSelect(id);
        }}
        focusMode="none"
        style={{ minWidth: 0 }}
      >
        <DataGridHeader className={styles.header}>
          <DataGridRow aria-rowindex={1}>{({ renderHeaderCell }) => <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>}</DataGridRow>
        </DataGridHeader>
        <DataGridBody<ApprovalListItem> style={{ paddingTop: start * ROW_HEIGHT, paddingBottom: (count - end) * ROW_HEIGHT }}>
          {({ item, rowId }) => (
            <DataGridRow<ApprovalListItem>
              key={rowId}
              className={mergeClasses(styles.row, item.id === selectedId && styles.selected)}
              onFocus={() => setFocusedId(item.id)}
              aria-rowindex={start + windowed.indexOf(item) + 2}
              selectionCell={{ radioIndicator: { "aria-label": t("list.selectRow", { title: item.title }) } }}
              tabIndex={item.id === tabStopId ? 0 : -1}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(item.id);
                } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  // Roving focus between rows; the rows beyond the rendered window appear as the list scrolls.
                  e.preventDefault();
                  const next = e.key === "ArrowDown" ? e.currentTarget.nextElementSibling : e.currentTarget.previousElementSibling;
                  if (next instanceof HTMLElement && next.getAttribute("role") === "row") next.focus();
                }
              }}
            >
              {({ renderCell: render }) => (
                <DataGridCell>
                  <TableCellLayout truncate>{render(item)}</TableCellLayout>
                </DataGridCell>
              )}
            </DataGridRow>
          )}
        </DataGridBody>
      </DataGrid>
      {footer}
    </div>
  );
}

function renderCell(column: ColumnId, item: ApprovalListItem, formatDate: (iso: string) => string) {
  switch (column) {
    case "title":
      return item.title;
    case "status":
      return <StatusBadge status={item.status} outcome={item.outcome} />;
    case "createdOn":
      return formatDate(item.createdOn);
    case "owner":
      return item.owner?.name ?? "";
    case "currentStep":
      return item.currentStep ?? "";
    case "lastDecision":
      return item.lastDecision ? `${item.lastDecision.approver.name}, ${formatDate(item.lastDecision.decidedOn)}` : "";
  }
}
