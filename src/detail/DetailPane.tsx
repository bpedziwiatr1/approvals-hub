import { Button, Spinner, makeStyles, tokens } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ApprovalDetail, ApprovalStepDetail, DataClient } from "../data/dataClient";

const useStyles = makeStyles({
  pane: {
    flex: "0 0 420px",
    maxWidth: "45%",
    overflowY: "auto",
    boxSizing: "border-box",
    padding: tokens.spacingHorizontalL,
    marginLeft: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  drawer: { padding: 0 },
  heading: { margin: 0, fontSize: tokens.fontSizeBase500, fontWeight: tokens.fontWeightSemibold },
  meta: { color: tokens.colorNeutralForeground2, margin: `${tokens.spacingVerticalXS} 0 ${tokens.spacingVerticalM}` },
  markdown: {
    overflowWrap: "anywhere",
    "& a": { color: tokens.colorBrandForegroundLink },
    "& table": { borderCollapse: "collapse" },
    "& th, & td": { border: `1px solid ${tokens.colorNeutralStroke2}`, padding: tokens.spacingHorizontalXS },
  },
  step: { border: "none", margin: `${tokens.spacingVerticalL} 0 0`, padding: 0 },
  stepTitle: { fontWeight: tokens.fontWeightSemibold, padding: 0 },
  response: { margin: `${tokens.spacingVerticalS} 0`, paddingLeft: tokens.spacingHorizontalM, borderLeft: `2px solid ${tokens.colorNeutralStroke2}` },
  comment: { margin: `${tokens.spacingVerticalXXS} 0 0`, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  muted: { color: tokens.colorNeutralForeground3 },
});

type Outcome = { kind: "error" } | { kind: "ready"; detail: ApprovalDetail };
/** A load result tagged with the request it answers; any other request key means still loading. */
interface Loaded {
  key: string;
  outcome: Outcome;
}

/**
 * Details of one Approval: markdown details (react-markdown renders no raw HTML and drops unsafe URLs),
 * Approval Responses grouped by Approval Step, pending and reassigned Approvers, and the Outcome.
 */
export function DetailPane({ client, approvalId, lang, layout = "side" }: { client: DataClient; approvalId: string | null; lang: string; layout?: "side" | "drawer" }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${approvalId}#${attempt}`;
  const state = loaded?.key === key ? loaded.outcome : null;
  const dateFormat = useMemo(() => new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short" }), [lang]);

  useEffect(() => {
    if (!approvalId) return;
    let current = true;
    client
      .getApprovalDetail(approvalId)
      .then((detail) => current && setLoaded({ key, outcome: { kind: "ready", detail } }))
      .catch(() => current && setLoaded({ key, outcome: { kind: "error" } }));
    return () => {
      current = false;
    };
  }, [client, approvalId, key]);

  return (
    <aside className={layout === "drawer" ? styles.drawer : styles.pane} aria-label={t("detail.region")}>
      {!approvalId ? (
        <p className={styles.muted}>{t("detail.none")}</p>
      ) : state === null ? (
        <Spinner label={t("detail.loading")} />
      ) : state.kind === "error" ? (
        <div role="alert">
          <p>{t("detail.error")}</p>
          <Button onClick={() => setAttempt((n) => n + 1)}>{t("detail.retry")}</Button>
        </div>
      ) : (
        <Ready detail={state.detail} format={(iso) => dateFormat.format(new Date(iso))} />
      )}
    </aside>
  );
}

function Ready({ detail, format }: { detail: ApprovalDetail; format: (iso: string) => string }) {
  const styles = useStyles();
  const { t } = useTranslation();
  return (
    <>
      <h2 className={styles.heading}>{detail.title}</h2>
      <p className={styles.meta}>
        {t(`status.${detail.status}`)} · {format(detail.createdOn)}
      </p>
      {detail.outcome && (
        <p>
          <strong>{t("detail.outcome")}</strong> {detail.outcome}
        </p>
      )}
      {detail.details && (
        <div className={styles.markdown}>
          <Markdown remarkPlugins={[remarkGfm]}>{detail.details}</Markdown>
        </div>
      )}
      {detail.steps.map((step) => (
        <Step key={step.number} step={step} format={format} />
      ))}
    </>
  );
}

function Step({ step, format }: { step: ApprovalStepDetail; format: (iso: string) => string }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const label = step.implicit
    ? t("detail.responses")
    : step.stage
      ? t("detail.stepNamed", { number: step.number, stage: step.stage })
      : t("detail.step", { number: step.number });
  return (
    <fieldset className={styles.step} role="group" aria-label={label}>
      <legend className={styles.stepTitle}>{label}</legend>
      {step.responses.length === 0 && <p className={styles.muted}>{t("detail.noResponses")}</p>}
      {step.responses.map((r, i) => (
        <div key={i} className={styles.response}>
          <div>
            <strong>{r.approver.name}</strong> · <span>{r.response}</span>
          </div>
          <div className={styles.muted}>{format(r.respondedOn)}</div>
          {r.comments && <p className={styles.comment}>{r.comments}</p>}
        </div>
      ))}
      {step.pendingApprovers.length > 0 && <ApproverList label={t("detail.waitingFor")} names={step.pendingApprovers.map((a) => a.name)} />}
      {step.reassignedApprovers.length > 0 && <ApproverList label={t("detail.reassigned")} names={step.reassignedApprovers.map((a) => a.name)} />}
    </fieldset>
  );
}

function ApproverList({ label, names }: { label: string; names: string[] }) {
  return (
    <div>
      <span>{label}</span>
      <ul>
        {names.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
