import { Button, DrawerBody, DrawerHeader, DrawerHeaderTitle, OverlayDrawer, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { Dismiss24Regular } from "@fluentui/react-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ResolvedProfile } from "../config/profileConfig";
import type { ApprovalQuery, DataClient } from "../data/dataClient";
import { DetailPane } from "../detail/DetailPane";
import { ApprovalGrid } from "../grid/ApprovalGrid";
import { useApprovalPages } from "../grid/useApprovalPages";
import { useNarrow } from "../useNarrow";

const useStyles = makeStyles({
  body: { flex: "1 1 auto", minHeight: 0, display: "flex" },
  more: { padding: tokens.spacingVerticalM },
});

interface ApprovalListProps {
  client: DataClient;
  query: ApprovalQuery;
  profile: ResolvedProfile;
  reloadKey: number;
  onSortChange: (sort: NonNullable<ApprovalQuery["sort"]>) => void;
}

/** The list of Approvals for one query with its loading, empty, no-permission and error states, and the detail pane beside it (a drawer when narrow). */
export function ApprovalList({ client, query, profile, reloadKey, onSortChange }: ApprovalListProps) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { items, continuationToken, loadingMore, failed, failure, loadMore, retry } = useApprovalPages(client, query, profile.pageSize, reloadKey);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const narrow = useNarrow();

  if (failed && !items) {
    return failure === "forbidden" ? (
      <p role="alert">{t("list.noPermission")}</p>
    ) : (
      <div role="alert">
        <p>{t("list.error")}</p>
        <Button onClick={retry}>{t("list.retry")}</Button>
      </div>
    );
  }
  if (items === null) return <Spinner label={t("list.loading")} />;
  if (items.length === 0) return <p>{t("list.empty")}</p>;

  return (
    <div className={styles.body}>
      <ApprovalGrid
        items={items}
        hasMore={continuationToken !== null}
        columns={profile.columns}
        sort={query.sort}
        onSortChange={onSortChange}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onNearEnd={loadMore}
        footer={
          <>
            {loadingMore && <Spinner size="tiny" className={styles.more} label={t("list.loadingMore")} />}
            {failed && (
              <p role="alert" className={styles.more}>
                {t("list.error")}
              </p>
            )}
          </>
        }
      />
      {narrow ? (
        <OverlayDrawer open={selectedId !== null} onOpenChange={(_, data) => !data.open && setSelectedId(null)} position="end" size="medium" aria-label={t("detail.region")}>
          <DrawerHeader>
            <DrawerHeaderTitle action={<Button appearance="subtle" aria-label={t("detail.close")} icon={<Dismiss24Regular />} onClick={() => setSelectedId(null)} />}>{t("detail.region")}</DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <DetailPane key={`${selectedId}|${reloadKey}`} client={client} approvalId={selectedId} layout="drawer" />
          </DrawerBody>
        </OverlayDrawer>
      ) : (
        <DetailPane key={`${selectedId}|${reloadKey}`} client={client} approvalId={selectedId} />
      )}
    </div>
  );
}
