import { FluentProvider, Spinner } from "@fluentui/react-components";
import { useEffect, useMemo, useState } from "react";
import { I18nextProvider } from "react-i18next";
import { loadProfile, type ConfigNotice, type ResolvedProfile } from "./config/profileConfig";
import type { CurrentUser, DataClient } from "./data/dataClient";
import { createI18n, resolveLang, type Lang } from "./i18n";
import { ApprovalsPage } from "./page/ApprovalsPage";
import { fluentTheme, type ThemeName } from "./theme";
import { browserOffsetMinutes } from "./time/userTime";
import { UserTimeProvider } from "./time/userTimeContext";

export interface AppProps {
  client: DataClient;
  /** Overrides the language of the user (`?lang=` in local development and tests). */
  lang?: Lang;
  theme: ThemeName;
}

type UserSettings = Pick<CurrentUser, "languageId" | "timeZoneOffsetMinutes">;

/** Used when the user cannot be read: English and the browser's time zone. */
const unknownUser = (): UserSettings => ({ languageId: 0, timeZoneOffsetMinutes: browserOffsetMinutes() });

export function App({ client, lang: langOverride, theme }: AppProps) {
  const [loaded, setLoaded] = useState<{ profile: ResolvedProfile; notices: ConfigNotice[]; user: UserSettings } | null>(null);
  const lang = langOverride ?? resolveLang(window.location.search, loaded?.user.languageId);
  const i18n = useMemo(() => createI18n(lang), [lang]);

  // The Profile comes from the environment variable and the language and time zone from the user's settings, read once through the DataClient;
  // neither read rejects (a failure becomes a notice or the fallback user).
  useEffect(() => {
    let current = true;
    void Promise.all([loadProfile(client, window.location.search), client.getCurrentUser().catch(unknownUser)]).then(([result, user]) => {
      if (current) setLoaded({ ...result, user });
    });
    return () => {
      current = false;
    };
  }, [client]);

  return (
    <I18nextProvider i18n={i18n}>
      <FluentProvider theme={fluentTheme(theme, loaded?.profile.accentColor)}>
        {loaded ? (
          <UserTimeProvider lang={lang} offsetMinutes={loaded.user.timeZoneOffsetMinutes}>
            <ApprovalsPage client={client} profile={loaded.profile} notices={loaded.notices} />
          </UserTimeProvider>
        ) : (
          <Spinner label={i18n.t("list.loading")} />
        )}
      </FluentProvider>
    </I18nextProvider>
  );
}
