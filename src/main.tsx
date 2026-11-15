import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { createMockClient, isScenarioName } from "./data/mockClient";
import { resolveLang } from "./i18n";
import { resolveTheme } from "./theme";

const params = new URLSearchParams(window.location.search);
const scenario = params.get("scenario");
const client = createMockClient(isScenarioName(scenario) ? scenario : "default");
const theme = resolveTheme(window.location.search, window.matchMedia("(prefers-color-scheme: dark)").matches);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App client={client} lang={resolveLang(window.location.search)} theme={theme} />
  </StrictMode>,
);
