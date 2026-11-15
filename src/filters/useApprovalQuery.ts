import { useEffect, useMemo, useState } from "react";
import type { ApprovalQuery } from "../data/dataClient";
import type { ResolvedProfile } from "../config/profileConfig";
import { userDayRange } from "../time/userTime";
import { useDebouncedValue } from "../useDebouncedValue";
import { STATUS_ORDER, readFilters, writeFilters, type Filters } from "./urlState";

const SEARCH_DEBOUNCE_MS = 300;

/** The filters at start: from the URL, with the Profile's default status while the URL carries no status filter of its own. */
function initialFilters(profile: ResolvedProfile): Filters {
  const fromUrl = readFilters(window.location.search);
  const hasStatusInUrl = new URLSearchParams(window.location.search).has("status");
  return !hasStatusInUrl && profile.defaultStatus ? { ...fromUrl, statuses: [profile.defaultStatus] } : fromUrl;
}

/**
 * The user's filters and the server query they and the Profile give. The Profile Scope always applies and lives only in the query,
 * never in the URL filter state or in any control, so users cannot remove it. Title search follows the debounced text, the rest applies at once.
 * The URL is kept in step with the filters actually applied, so the address can be shared.
 */
export function useApprovalQuery(profile: ResolvedProfile, offsetMinutes: number) {
  const [filters, setFilters] = useState<Filters>(() => initialFilters(profile));
  const [sort, setSort] = useState<ApprovalQuery["sort"]>(undefined);
  const title = useDebouncedValue(filters.title.trim(), SEARCH_DEBOUNCE_MS);
  const statusKey = filters.statuses.join(",");
  const { ownerId, approverId, createdFrom, createdTo, assignedToMe } = filters;
  const pendingOnly = assignedToMe?.pendingOnly;
  const assigned = assignedToMe !== undefined;
  const scope = profile.scope;
  const hasScope = Object.keys(scope).length > 0;

  const query = useMemo<ApprovalQuery>(
    () => ({
      ...(hasScope ? { scope } : {}),
      ...(title ? { title } : {}),
      ...(statusKey ? { statuses: STATUS_ORDER.filter((s) => statusKey.split(",").includes(s)) } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(approverId ? { approverId } : {}),
      // The days are the user's calendar days (their Dataverse time zone), both ends inclusive.
      ...userDayRange({ from: createdFrom, to: createdTo }, offsetMinutes),
      ...(assigned ? { assignedToMe: { pendingOnly: pendingOnly === true } } : {}),
      ...(sort ? { sort } : {}),
    }),
    [hasScope, scope, title, statusKey, ownerId, approverId, createdFrom, createdTo, assigned, pendingOnly, offsetMinutes, sort],
  );

  useEffect(() => {
    const search = writeFilters(window.location.search, {
      title,
      statuses: query.statuses ?? [],
      ownerId,
      approverId,
      createdFrom,
      createdTo,
      assignedToMe: assigned ? { pendingOnly: pendingOnly === true } : undefined,
    });
    if (search !== window.location.search) window.history.replaceState(window.history.state, "", `${window.location.pathname}${search}${window.location.hash}`);
  }, [title, query.statuses, ownerId, approverId, createdFrom, createdTo, assigned, pendingOnly]);

  return { filters, setFilters, query, sort, setSort };
}
