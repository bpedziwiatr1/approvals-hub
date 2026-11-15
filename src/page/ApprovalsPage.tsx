import { Button, Switch, makeStyles, tokens } from "@fluentui/react-components";
import { ArrowClockwise16Regular, ArrowDownload16Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ConfigNotice, ResolvedProfile } from "../config/profileConfig";
import type { ApprovalListItem, DataClient } from "../data/dataClient";
import { downloadCsv, toCsv } from "../export/csv";
import { FilterBar } from "../filters/FilterBar";
import { useApprovalQuery } from "../filters/useApprovalQuery";
import { SummaryTiles } from "../summary/SummaryTiles";
import { useUserTime } from "../time/userTimeContext";
import { ApprovalList } from "./ApprovalList";

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
  commands: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalM, marginBottom: tokens.spacingVerticalM },
});

interface PageProps {
  client: DataClient;
  profile: ResolvedProfile;
  notices: ConfigNotice[];
}

/** The page of one Profile: title, notices, command bar, summary, filters and the list. */
export function ApprovalsPage({ client, profile, notices }: PageProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { offsetMinutes } = useUserTime();
  const { filters, setFilters, query, setSort } = useApprovalQuery(profile, offsetMinutes);

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
      <FilterBar filters={filters} setFilters={setFilters} />
      {/* Remounted per query: a new filter or sort starts at the top of a fresh list. */}
      <ApprovalList key={pageKey} client={client} query={query} profile={profile} reloadKey={refreshKey} onSortChange={setSort} />
    </main>
  );
}
