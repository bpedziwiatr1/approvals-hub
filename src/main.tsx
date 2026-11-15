import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { selectClient } from "./data/selectClient";
import type { HostWindow } from "./data/xrm/xrmClient";
import { langFromSearch } from "./i18n";
import { resolveTheme } from "./theme";

const { client, openedRecords } = selectClient(window.location.search, window as unknown as HostWindow);
const theme = resolveTheme(window.location.search, window.matchMedia("(prefers-color-scheme: dark)").matches);

// Local clients only: lets e2e tests observe which record the page asked to open.
if (openedRecords) (window as unknown as { __openedRecords: () => unknown }).__openedRecords = openedRecords;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} lang={langFromSearch(window.location.search) ?? undefined} theme={theme} />
  </StrictMode>,
);
