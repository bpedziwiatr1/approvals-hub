import { Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ApprovalQuery, DataClient } from "../data/dataClient";
import { toTiles, type SummaryTiles as Tiles } from "../data/statusTiles";

const useStyles = makeStyles({
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
});

const TILES: { key: keyof Tiles; label: string }[] = [
  { key: "pending", label: "status.pending" },
  { key: "approved", label: "status.approved" },
  { key: "rejected", label: "status.rejected" },
  { key: "other", label: "summary.other" },
];

/** Counts per summary tile under the applied query; remounted per query, so it starts with no numbers. */
export function SummaryTiles({ client, query }: { client: DataClient; query: ApprovalQuery }) {
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
