import {
  Button,
  Checkbox,
  FluentProvider,
  Input,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableCellLayout,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { ApprovalListItem, ApprovalQuery, DataClient } from "./data/dataClient";
import { toTiles, type SummaryTiles as Tiles } from "./data/statusTiles";
import { downloadCsv, toCsv } from "./export/csv";
import { STATUS_ORDER, readFilters, writeFilters, type Filters } from "./filters/urlState";
import { StatusBadge } from "./StatusBadge";
import { useDebouncedValue } from "./useDebouncedValue";
import { visibleRange } from "./grid/virtualRange";
import { createI18n, type Lang } from "./i18n";
import { fluentTheme, type ThemeName } from "./theme";

const PAGE_SIZE = 100;
const ROW_HEIGHT = 44;
const OVERSCAN = 10;
/** Used until the scroll container has been laid out (and in jsdom, which has no layout). */
const FALLBACK_VIEWPORT_HEIGHT = 800;
const COLUMN_COUNT = 3;
const SEARCH_DEBOUNCE_MS = 300;

const useStyles = makeStyles({
  page: {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    padding: tokens.spacingHorizontalXL,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  title: { margin: 0, marginBottom: tokens.spacingVerticalL, fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold },
  scroller: {
    flex: "1 1 auto",
    minHeight: 0,
    overflowY: "auto",
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  commands: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  summary: { display: "flex", flexWrap: "wrap", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
  tile: {
    display: "flex",
    flexDirection: "column",
    minWidth: "120px",
    padding: tokens.spacingVerticalS + " " + tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
  },
  tileCount: { fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold, color: tokens.colorNeutralForeground1 },
  filterBar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalM },
  search: { minWidth: "280px" },
  statuses: { display: "flex", flexWrap: "wrap", border: "none", margin: 0, padding: 0 },
  header: { position: "sticky", top: 0, zIndex: 1, backgroundColor: tokens.colorNeutralBackground1 },
  row: { height: `${ROW_HEIGHT}px` },
  more: { padding: tokens.spacingVerticalM },
});

export interface AppProps {
  client: DataClient;
  lang: Lang;
  theme: ThemeName;
}

export function App({ client, lang, theme }: AppProps) {
  const i18n = useMemo(() => createI18n(lang), [lang]);
  return (
    <I18nextProvider i18n={i18n}>
      <FluentProvider theme={fluentTheme(theme)}>
        <ApprovalsPage client={client} lang={lang} />
      </FluentProvider>
    </I18nextProvider>
  );
}

interface ListState {
  items: ApprovalListItem[] | null;
  continuationToken: string | null;
  loadingMore: boolean;
  failed: boolean;
}

const INITIAL: ListState = { items: null, continuationToken: null, loadingMore: false, failed: false };

/** Loads the list one server page at a time; `loadMore` fetches the next page when there is one. */
function useApprovalPages(client: DataClient, query: ApprovalQuery) {
  const [state, setState] = useState<ListState>(INITIAL);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    inFlight.current = true;
    client
      .listApprovals(query, { size: PAGE_SIZE })
      .then((page) => {
        if (gen === generation.current) setState({ ...INITIAL, items: page.items, continuationToken: page.continuationToken });
      })
      .catch(() => {
        if (gen === generation.current) setState({ ...INITIAL, failed: true });
      })
      .finally(() => {
        if (gen === generation.current) inFlight.current = false;
      });
    return () => {
      generation.current += 1;
      inFlight.current = false;
    };
  }, [client, query]);

  const loadMore = useCallback(() => {
    const token = state.continuationToken;
    if (!token || inFlight.current || state.failed) return;
    const gen = generation.current;
    inFlight.current = true;
    setState((s) => ({ ...s, loadingMore: true }));
    client
      .listApprovals(query, { size: PAGE_SIZE, continuationToken: token })
      .then((page) => {
        if (gen === generation.current)
          setState((s) => ({ ...s, items: [...(s.items ?? []), ...page.items], continuationToken: page.continuationToken, loadingMore: false }));
      })
      .catch(() => {
        if (gen === generation.current) setState((s) => ({ ...s, loadingMore: false, failed: true }));
      })
      .finally(() => {
        if (gen === generation.current) inFlight.current = false;
      });
  }, [client, query, state.continuationToken, state.failed]);

  return { ...state, loadMore };
}

function ApprovalsPage({ client, lang }: { client: DataClient; lang: Lang }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>(() => readFilters(window.location.search));
  const title = useDebouncedValue(filters.title.trim(), SEARCH_DEBOUNCE_MS);
  const statusKey = filters.statuses.join(",");

  // The server query: title search follows the debounced text, statuses apply at once.
  const query = useMemo<ApprovalQuery>(
    () => ({ ...(title ? { title } : {}), ...(statusKey ? { statuses: STATUS_ORDER.filter((s) => statusKey.split(",").includes(s)) } : {}) }),
    [title, statusKey],
  );

  // Keep the URL in step with the filters actually applied, so the address can be shared.
  useEffect(() => {
    const search = writeFilters(window.location.search, { title, statuses: query.statuses ?? [] });
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [title, query.statuses]);

  const toggleStatus = (status: Filters["statuses"][number], checked: boolean) =>
    setFilters((f) => ({ ...f, statuses: checked ? [...f.statuses, status] : f.statuses.filter((s) => s !== status) }));

  // Refresh remounts the list and the summary, so both load again from the server.
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSummary, setShowSummary] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const pageKey = `${title}|${statusKey}|${refreshKey}`;

  // Exports every Approval matching the applied query, not only the rows loaded in the list.
  const exportCsv = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      const items: ApprovalListItem[] = [];
      for await (const item of client.exportApprovals(query)) items.push(item);
      downloadCsv(toCsv(items), `approvals-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("app.title")}</h1>
      <div className={styles.commands} role="toolbar" aria-label={t("command.region")}>
        <Button appearance="subtle" icon={<ArrowClockwise16Regular />} onClick={() => setRefreshKey((k) => k + 1)}>
          {t("command.refresh")}
        </Button>
        <Button appearance="subtle" icon={<ArrowDownload16Regular />} disabled={exporting} onClick={exportCsv}>
          {t("command.export")}
        </Button>
        <Switch label={t("command.summary")} checked={showSummary} onChange={(_, data) => setShowSummary(data.checked)} />
        {exportFailed && <span role="alert">{t("export.error")}</span>}
      </div>
      {showSummary && <SummaryTiles key={`summary|${pageKey}`} client={client} query={query} />}
      <div className={styles.filterBar}>
        <Input
          type="search"
          className={styles.search}
          aria-label={t("filter.search")}
          placeholder={t("filter.search")}
          value={filters.title}
          onChange={(_, data) => setFilters((f) => ({ ...f, title: data.value }))}
        />
        <fieldset className={styles.statuses}>
          <legend style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{t("filter.status")}</legend>
          {STATUS_ORDER.map((status) => (
            <Checkbox key={status} label={t(`status.${status}`)} checked={filters.statuses.includes(status)} onChange={(_, data) => toggleStatus(status, data.checked === true)} />
          ))}
        </fieldset>
      </div>
      {/* Remounted per query: a new filter starts at the top of a fresh list. */}
      <ApprovalList key={pageKey} client={client} lang={lang} query={query} />
    </main>
  );
}

const TILES: { key: keyof Tiles; label: string }[] = [
  { key: "pending", label: "status.pending" },
  { key: "approved", label: "status.approved" },
  { key: "rejected", label: "status.rejected" },
  { key: "other", label: "summary.other" },
];

/** Counts per summary tile under the applied query; remounted per query, so it starts with no numbers. */
function SummaryTiles({ client, query }: { client: DataClient; query: ApprovalQuery }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [tiles, setTiles] = useState<Tiles | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    client
      .countByStatus(query)
      .then((counts) => current && setTiles(toTiles(counts)))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [client, query]);

  if (failed) return <p role="alert">{t("summary.error")}</p>;
  if (!tiles) return <Spinner size="tiny" label={t("summary.loading")} />;
  return (
    <div role="group" aria-label={t("summary.region")} className={styles.summary}>
      {TILES.map(({ key, label }) => (
        <div key={key} role="group" aria-label={t(label)} className={styles.tile}>
          <span>{t(label)}</span>
          <span className={styles.tileCount}>{tiles[key]}</span>
        </div>
      ))}
    </div>
  );
}

function ApprovalList({ client, lang, query }: { client: DataClient; lang: Lang; query: ApprovalQuery }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { items, continuationToken, loadingMore, failed, loadMore } = useApprovalPages(client, query);
  const [scroll, setScroll] = useState({ top: 0, height: FALLBACK_VIEWPORT_HEIGHT });

  const count = items?.length ?? 0;
  const { start, end } = visibleRange({ scrollTop: scroll.top, viewportHeight: scroll.height, rowHeight: ROW_HEIGHT, count, overscan: OVERSCAN });

  // Fetch the next server page once the rendered window reaches the end of what is loaded.
  useEffect(() => {
    if (count > 0 && end >= count - OVERSCAN) loadMore();
  }, [count, end, loadMore]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    setScroll({ top: el.scrollTop, height: el.clientHeight || FALLBACK_VIEWPORT_HEIGHT });
  };

  const dateFormat = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }), [lang]);

  return (
    <>
      {failed && !items ? (
        <p role="alert">{t("list.error")}</p>
      ) : items === null ? (
        <Spinner label={t("list.loading")} />
      ) : items.length === 0 ? (
        <p>{t("list.empty")}</p>
      ) : (
        <div role="region" aria-label={t("list.region")} className={styles.scroller} onScroll={onScroll}>
          <Table role="grid" aria-label={t("app.title")} aria-rowcount={continuationToken ? -1 : count + 1}>
            <TableHeader className={styles.header}>
              <TableRow aria-rowindex={1}>
                <TableHeaderCell>{t("list.column.title")}</TableHeaderCell>
                <TableHeaderCell>{t("list.column.status")}</TableHeaderCell>
                <TableHeaderCell>{t("list.column.createdOn")}</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {start > 0 && <Spacer height={start * ROW_HEIGHT} />}
              {items.slice(start, end).map((item, i) => (
                <TableRow key={item.id} className={styles.row} aria-rowindex={start + i + 2}>
                  <TableCell>
                    <TableCellLayout truncate>{item.title}</TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout truncate>
                      <StatusBadge status={item.status} outcome={item.outcome} />
                    </TableCellLayout>
                  </TableCell>
                  <TableCell>
                    <TableCellLayout truncate>{dateFormat.format(new Date(item.createdOn))}</TableCellLayout>
                  </TableCell>
                </TableRow>
              ))}
              {end < count && <Spacer height={(count - end) * ROW_HEIGHT} />}
            </TableBody>
          </Table>
          {loadingMore && <Spinner size="tiny" className={styles.more} label={t("list.loadingMore")} />}
          {failed && (
            <p role="alert" className={styles.more}>
              {t("list.error")}
            </p>
          )}
        </div>
      )}
    </>
  );
}

/** Stands in for rows outside the rendered window so the scrollbar matches the loaded list; hidden from assistive technology. */
function Spacer({ height }: { height: number }) {
  return (
    <tr aria-hidden="true" style={{ height }}>
      <td colSpan={COLUMN_COUNT} style={{ padding: 0, border: 0 }} />
    </tr>
  );
}
