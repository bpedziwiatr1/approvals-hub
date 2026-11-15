import {
  FluentProvider,
  Spinner,
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
import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { ApprovalListItem, DataClient } from "./data/dataClient";
import { visibleRange } from "./grid/virtualRange";
import { createI18n, type Lang } from "./i18n";
import { fluentTheme, type ThemeName } from "./theme";

const PAGE_SIZE = 100;
const ROW_HEIGHT = 44;
const OVERSCAN = 10;
/** Used until the scroll container has been laid out (and in jsdom, which has no layout). */
const FALLBACK_VIEWPORT_HEIGHT = 800;
const COLUMN_COUNT = 3;

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
function useApprovalPages(client: DataClient) {
  const [state, setState] = useState<ListState>(INITIAL);
  const inFlight = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const gen = ++generation.current;
    inFlight.current = true;
    client
      .listApprovals({}, { size: PAGE_SIZE })
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
  }, [client]);

  const loadMore = useCallback(() => {
    const token = state.continuationToken;
    if (!token || inFlight.current || state.failed) return;
    const gen = generation.current;
    inFlight.current = true;
    setState((s) => ({ ...s, loadingMore: true }));
    client
      .listApprovals({}, { size: PAGE_SIZE, continuationToken: token })
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
  }, [client, state.continuationToken, state.failed]);

  return { ...state, loadMore };
}

function ApprovalsPage({ client, lang }: { client: DataClient; lang: Lang }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { items, continuationToken, loadingMore, failed, loadMore } = useApprovalPages(client);
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
    <main className={styles.page}>
      <h1 className={styles.title}>{t("app.title")}</h1>
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
                    <TableCellLayout truncate>{t(`status.${item.status}`)}</TableCellLayout>
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
    </main>
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
