import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { selectClient } from "./data/selectClient";
import type { HostWindow } from "./data/xrm/xrmClient";
import { resolveLang } from "./i18n";
import { resolveTheme } from "./theme";

const { client } = selectClient(window.location.search, window as unknown as HostWindow);
const theme = resolveTheme(window.location.search, window.matchMedia("(prefers-color-scheme: dark)").matches);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} lang={resolveLang(window.location.search)} theme={theme} />
  </StrictMode>,
);
