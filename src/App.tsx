import {
  Button,
  Checkbox,
  FluentProvider,
  Input,
  OverlayDrawer,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
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
  mergeClasses,
  tokens,
} from "@fluentui/react-components";
import { ArrowClockwise16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { I18nextProvider, useTranslation } from "react-i18next";
import { loadProfile, type ColumnId, type ConfigNotice, type ResolvedProfile } from "./config/profileConfig";
import { DataError, type ApprovalListItem, ApprovalQuery, DataClient } from "./data/dataClient";
import { toTiles, type SummaryTiles as Tiles } from "./data/statusTiles";
import { downloadCsv, toCsv } from "./export/csv";
import { DetailPane } from "./detail/DetailPane";
import { STATUS_ORDER, readFilters, writeFilters, type Filters } from "./filters/urlState";
import { StatusBadge } from "./StatusBadge";
import { useNarrow } from "./useNarrow";
import { useDebouncedValue } from "./useDebouncedValue";
import { visibleRange } from "./grid/virtualRange";
import { createI18n, type Lang } from "./i18n";
import { fluentTheme, type ThemeName } from "./theme";

const ROW_HEIGHT = 44;
const OVERSCAN = 10;
/** Used until the scroll container has been laid out (and in jsdom, which has no layout). */
const FALLBACK_VIEWPORT_HEIGHT = 800;
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
  row: { height: `${ROW_HEIGHT}px`, cursor: "pointer" },
  selected: { backgroundColor: tokens.colorNeutralBackground1Selected },
  body: { flex: "1 1 auto", minHeight: 0, display: "flex" },
  more: { padding: tokens.spacingVerticalM },
});

export interface AppProps {
  client: DataClient;
  lang: Lang;
  theme: ThemeName;
}

export function App({ client, lang, theme }: AppProps) {
  const i18n = useMemo(() => createI18n(lang), [lang]);
  const [loaded, setLoaded] = useState<{ profile: ResolvedProfile; notices: ConfigNotice[] } | null>(null);

  // The Profile comes from the environment variable, read once through the DataClient; loadProfile never rejects.
  useEffect(() => {
    let current = true;
    void loadProfile(client, window.location.search).then((result) => {
      if (current) setLoaded(result);
    });
    return () => {
      current = false;
    };
  }, [client]);

  return (
    <I18nextProvider i18n={i18n}>
      <FluentProvider theme={fluentTheme(theme, loaded?.profile.accentColor)}>
        {loaded ? <ApprovalsPage client={client} lang={lang} profile={loaded.profile} notices={loaded.notices} /> : <Spinner label={i18n.t("list.loading")} />}
      </FluentProvider>
    </I18nextProvider>
  );
}

interface ListState {
  items: ApprovalListItem[] | null;
  continuationToken: string | null;
  loadingMore: boolean;
  failed: boolean;
  /** Why the first page failed: no permission gets its own message and no retry. */
  failure: "forbidden" | "server" | null;
}

const INITIAL: ListState = { items: null, continuationToken: null, loadingMore: false, failed: false, failure: null };

/** Loads the list one server page at a time; `loadMore` fetches the next page when there is one. */
function useApprovalPages(client: DataClient, query: ApprovalQuery, pageSize: number, reloadKey: number) {
  const [state, setState] = useState<ListState>(INITIAL);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const gen = ++generation.current;
    inFlight.current = true;
    client
      .listApprovals(query, { size: pageSize })
      .then((page) => {
        if (gen === generation.current) setState({ ...INITIAL, items: page.items, continuationToken: page.continuationToken });
      })
      .catch((error: unknown) => {
        if (gen === generation.current) setState({ ...INITIAL, failed: true, failure: error instanceof DataError && error.kind === "forbidden" ? "forbidden" : "server" });
      })
      .finally(() => {
        if (gen === generation.current) inFlight.current = false;
      });
    return () => {
      generation.current += 1;
      inFlight.current = false;
    };
  }, [client, query, pageSize, reloadKey, attempt]);

  const retry = useCallback(() => {
    setState(INITIAL);
    setAttempt((n) => n + 1);
  }, []);

  const loadMore = useCallback(() => {
    const token = state.continuationToken;
    if (!token || inFlight.current || state.failed) return;
    const gen = generation.current;
    inFlight.current = true;
    setState((s) => ({ ...s, loadingMore: true }));
    client
      .listApprovals(query, { size: pageSize, continuationToken: token })
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
  }, [client, query, pageSize, state.continuationToken, state.failed]);

  return { ...state, loadMore, retry };
}

interface PageProps {
  client: DataClient;
  lang: Lang;
  profile: ResolvedProfile;
  notices: ConfigNotice[];
}

function ApprovalsPage({ client, lang, profile, notices }: PageProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [filters, setFilters] = useState<Filters>(() => {
    const fromUrl = readFilters(window.location.search);
    // The Profile's default status applies only while the URL carries no status filter of its own.
    const hasStatusInUrl = new URLSearchParams(window.location.search).has("status");
    return !hasStatusInUrl && profile.defaultStatus ? { ...fromUrl, statuses: [profile.defaultStatus] } : fromUrl;
  });
  const title = useDebouncedValue(filters.title.trim(), SEARCH_DEBOUNCE_MS);
  const statusKey = filters.statuses.join(",");
  const { ownerId, approverId, createdFrom, createdTo, assignedToMe } = filters;
  const pendingOnly = assignedToMe?.pendingOnly;
  const assigned = assignedToMe !== undefined;

  // The server query: the Profile Scope always applies; title search follows the debounced text, statuses apply at once.
  // The scope lives only here, never in the URL filter state or in any control, so users cannot remove it.
  const scope = profile.scope;
  const hasScope = Object.keys(scope).length > 0;
  const query = useMemo<ApprovalQuery>(
    () => ({
      ...(hasScope ? { scope } : {}),
      ...(title ? { title } : {}),
      ...(statusKey ? { statuses: STATUS_ORDER.filter((s) => statusKey.split(",").includes(s)) } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(approverId ? { approverId } : {}),
      // Calendar days are UTC days, both ends inclusive.
      ...(createdFrom ? { createdFrom: `${createdFrom}T00:00:00.000Z` } : {}),
      ...(createdTo ? { createdTo: `${createdTo}T23:59:59.999Z` } : {}),
      ...(assigned ? { assignedToMe: { pendingOnly: pendingOnly === true } } : {}),
    }),
    [hasScope, scope, title, statusKey, ownerId, approverId, createdFrom, createdTo, assigned, pendingOnly],
  );

  // Keep the URL in step with the filters actually applied, so the address can be shared.
  useEffect(() => {
    const search = writeFilters(window.location.search, { title, statuses: query.statuses ?? [], ownerId, approverId, createdFrom, createdTo, assignedToMe: assigned ? { pendingOnly: pendingOnly === true } : undefined });
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [title, query.statuses, ownerId, approverId, createdFrom, createdTo, assigned, pendingOnly]);

  const toggleStatus = (status: Filters["statuses"][number], checked: boolean) =>
    setFilters((f) => ({ ...f, statuses: checked ? [...f.statuses, status] : f.statuses.filter((s) => s !== status) }));

  // Refresh bumps refreshKey: the summary remounts and the list and open detail load again, the selection stays.
  const [refreshKey, setRefreshKey] = useState(0);
  const [showSummary, setShowSummary] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const pageKey = JSON.stringify(query);

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
      <h1 className={styles.title}>{profile.pageTitle ?? t("app.title")}</h1>
      {notices.map((notice) => (
        <p key={notice.kind} role="alert">
          {notice.kind === "invalidConfig" ? t("config.invalid", { detail: notice.detail }) : t("config.unknownProfile", { name: notice.name })}
        </p>
      ))}
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
      {showSummary && <SummaryTiles key={`summary|${pageKey}|${refreshKey}`} client={client} query={query} />}
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
      <div className={styles.filterBar}>
        <GuidInput label={t("filter.owner")} value={ownerId} onChange={(id) => setFilters((f) => ({ ...f, ownerId: id }))} />
        <GuidInput label={t("filter.approver")} value={approverId} onChange={(id) => setFilters((f) => ({ ...f, approverId: id }))} />
        <Input type="date" aria-label={t("filter.createdFrom")} value={createdFrom ?? ""} onChange={(_, data) => setFilters((f) => ({ ...f, createdFrom: data.value || undefined }))} />
        <Input type="date" aria-label={t("filter.createdTo")} value={createdTo ?? ""} onChange={(_, data) => setFilters((f) => ({ ...f, createdTo: data.value || undefined }))} />
        <Checkbox
          label={t("filter.assignedToMe")}
          checked={assigned}
          onChange={(_, data) => setFilters((f) => ({ ...f, assignedToMe: data.checked === true ? { pendingOnly: f.assignedToMe?.pendingOnly ?? false } : undefined }))}
        />
        <Checkbox
          label={t("filter.pendingOnly")}
          disabled={!assigned}
          checked={pendingOnly === true}
          onChange={(_, data) => setFilters((f) => ({ ...f, assignedToMe: { pendingOnly: data.checked === true } }))}
        />
      </div>
      {/* Remounted per query: a new filter starts at the top of a fresh list. */}
      <ApprovalList key={pageKey} client={client} lang={lang} query={query} profile={profile} reloadKey={refreshKey} />
    </main>
  );
}

const GUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** A user id box: the filter applies once the text is a GUID, and clears when the box is emptied. */
function GuidInput({ label, value, onChange }: { label: string; value: string | undefined; onChange: (id: string | undefined) => void }) {
  const [text, setText] = useState(value ?? "");
  const invalid = text.trim() !== "" && !GUID.test(text.trim());
  return (
    <Input
      aria-label={label}
      aria-invalid={invalid}
      placeholder={label}
      value={text}
      onChange={(_, data) => {
        setText(data.value);
        const id = data.value.trim();
        if (id === "") onChange(undefined);
        else if (GUID.test(id)) onChange(id);
      }}
    />
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

function ApprovalList({ client, lang, query, profile, reloadKey }: { client: DataClient; lang: Lang; query: ApprovalQuery; profile: ResolvedProfile; reloadKey: number }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { items, continuationToken, loadingMore, failed, failure, loadMore, retry } = useApprovalPages(client, query, profile.pageSize, reloadKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const narrow = useNarrow();
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
        failure === "forbidden" ? (
          <p role="alert">{t("list.noPermission")}</p>
        ) : (
          <div role="alert">
            <p>{t("list.error")}</p>
            <Button onClick={retry}>{t("list.retry")}</Button>
          </div>
        )
      ) : items === null ? (
        <Spinner label={t("list.loading")} />
      ) : items.length === 0 ? (
        <p>{t("list.empty")}</p>
      ) : (
        <div className={styles.body}>
        <div role="region" aria-label={t("list.region")} className={styles.scroller} onScroll={onScroll}>
          <Table role="grid" aria-label={t("app.title")} aria-rowcount={continuationToken ? -1 : count + 1}>
            <TableHeader className={styles.header}>
              <TableRow aria-rowindex={1}>
                {profile.columns.map((column) => (
                  <TableHeaderCell key={column}>{t(`list.column.${column}`)}</TableHeaderCell>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {start > 0 && <Spacer height={start * ROW_HEIGHT} columns={profile.columns.length} />}
              {items.slice(start, end).map((item, i) => (
                <TableRow
                  key={item.id}
                  className={mergeClasses(styles.row, item.id === selectedId && styles.selected)}
                  aria-rowindex={start + i + 2}
                  aria-selected={item.id === selectedId}
                  tabIndex={0}
                  onClick={() => setSelectedId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedId(item.id);
                    }
                  }}
                >
                  {profile.columns.map((column) => (
                    <TableCell key={column}>
                      <TableCellLayout truncate>{renderCell(column, item, dateFormat)}</TableCellLayout>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {end < count && <Spacer height={(count - end) * ROW_HEIGHT} columns={profile.columns.length} />}
            </TableBody>
          </Table>
          {loadingMore && <Spinner size="tiny" className={styles.more} label={t("list.loadingMore")} />}
          {failed && (
            <p role="alert" className={styles.more}>
              {t("list.error")}
            </p>
          )}
        </div>
        {narrow ? (
          <OverlayDrawer open={selectedId !== null} onOpenChange={(_, data) => !data.open && setSelectedId(null)} position="end" size="medium" aria-label={t("detail.region")}>
            <DrawerHeader>
              <DrawerHeaderTitle action={<Button appearance="subtle" aria-label={t("detail.close")} icon={<Dismiss24Regular />} onClick={() => setSelectedId(null)} />}>{t("detail.region")}</DrawerHeaderTitle>
            </DrawerHeader>
            <DrawerBody>
              <DetailPane key={`${selectedId}|${reloadKey}`} client={client} approvalId={selectedId} lang={lang} layout="drawer" />
            </DrawerBody>
          </OverlayDrawer>
        ) : (
          <DetailPane key={`${selectedId}|${reloadKey}`} client={client} approvalId={selectedId} lang={lang} />
        )}
        </div>
      )}
    </>
  );
}

function renderCell(column: ColumnId, item: ApprovalListItem, dateFormat: Intl.DateTimeFormat) {
  switch (column) {
    case "title":
      return item.title;
    case "status":
      return <StatusBadge status={item.status} outcome={item.outcome} />;
    case "createdOn":
      return dateFormat.format(new Date(item.createdOn));
  }
}

/** Stands in for rows outside the rendered window so the scrollbar matches the loaded list; hidden from assistive technology. */
function Spacer({ height, columns }: { height: number; columns: number }) {
  return (
    <tr aria-hidden="true" style={{ height }}>
      <td colSpan={columns} style={{ padding: 0, border: 0 }} />
    </tr>
  );
}
