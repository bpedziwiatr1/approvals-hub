import { useCallback, useEffect, useRef, useState } from "react";
import { DataError, type ApprovalListItem, type ApprovalQuery, type DataClient } from "../data/dataClient";

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
export function useApprovalPages(client: DataClient, query: ApprovalQuery, pageSize: number, reloadKey: number) {
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
