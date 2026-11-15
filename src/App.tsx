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
import { useEffect, useMemo, useState } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";
import type { ApprovalListItem, DataClient } from "./data/dataClient";
import { createI18n, type Lang } from "./i18n";
import { fluentTheme, type ThemeName } from "./theme";

const useStyles = makeStyles({
  page: {
    minHeight: "100vh",
    boxSizing: "border-box",
    padding: tokens.spacingHorizontalXL,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
  },
  title: { margin: 0, marginBottom: tokens.spacingVerticalL, fontSize: tokens.fontSizeHero700, fontWeight: tokens.fontWeightSemibold },
  grid: { backgroundColor: tokens.colorNeutralBackground1, borderRadius: tokens.borderRadiusMedium },
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

function ApprovalsPage({ client, lang }: { client: DataClient; lang: Lang }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [items, setItems] = useState<ApprovalListItem[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    client
      .listApprovals({}, { size: 50 })
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const formatDate = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{t("app.title")}</h1>
      {failed ? (
        <p role="alert">{t("list.error")}</p>
      ) : items === null ? (
        <Spinner label={t("list.loading")} />
      ) : items.length === 0 ? (
        <p>{t("list.empty")}</p>
      ) : (
        <Table role="grid" aria-label={t("app.title")} className={styles.grid}>
          <TableHeader>
            <TableRow>
              <TableHeaderCell>{t("list.column.title")}</TableHeaderCell>
              <TableHeaderCell>{t("list.column.status")}</TableHeaderCell>
              <TableHeaderCell>{t("list.column.createdOn")}</TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <TableCellLayout>{item.title}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>{t(`status.${item.status}`)}</TableCellLayout>
                </TableCell>
                <TableCell>
                  <TableCellLayout>{formatDate(item.createdOn)}</TableCellLayout>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </main>
  );
}
