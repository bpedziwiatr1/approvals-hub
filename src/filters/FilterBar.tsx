import { Checkbox, Input, makeStyles, tokens } from "@fluentui/react-components";
import { useState, type Dispatch, type SetStateAction } from "react";
import { useTranslation } from "react-i18next";
import { STATUS_ORDER, type Filters } from "./urlState";

const useStyles = makeStyles({
  filterBar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: tokens.spacingHorizontalL, marginBottom: tokens.spacingVerticalM },
  search: { minWidth: "280px" },
  statuses: { display: "flex", flexWrap: "wrap", border: "none", margin: 0, padding: 0 },
});

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

/** The user's filters: title search, status, Owner, Approver, created-on range and Assigned to me. */
export function FilterBar({ filters, setFilters }: { filters: Filters; setFilters: Dispatch<SetStateAction<Filters>> }) {
  const styles = useStyles();
  const { t } = useTranslation();
  const { ownerId, approverId, createdFrom, createdTo, assignedToMe } = filters;
  const assigned = assignedToMe !== undefined;
  const pendingOnly = assignedToMe?.pendingOnly;

  const toggleStatus = (status: Filters["statuses"][number], checked: boolean) =>
    setFilters((f) => ({ ...f, statuses: checked ? [...f.statuses, status] : f.statuses.filter((s) => s !== status) }));

  return (
    <>
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
    </>
  );
}
