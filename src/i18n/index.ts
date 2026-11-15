import { createInstance, type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import pl from "./pl.json";

export type Lang = "en" | "pl";

/** Dataverse language (LCID) of Polish; every other language shows English. */
export const POLISH_LANGUAGE_ID = 1045;

/** The `?lang=` override for local development and tests: "en" or "pl"; null when absent or unknown. */
export function langFromSearch(search: string): Lang | null {
  const lang = new URLSearchParams(search).get("lang");
  return lang === "pl" || lang === "en" ? lang : null;
}

/** Page language: `?lang=` when given, else from the user's Dataverse language (userSettings.languageId), else English. */
export function resolveLang(search: string, languageId?: number): Lang {
  return langFromSearch(search) ?? (languageId === POLISH_LANGUAGE_ID ? "pl" : "en");
}

export function createI18n(lang: Lang): i18n {
  const instance = createInstance();
  void instance.use(initReactI18next).init({
    lng: lang,
    fallbackLng: "en",
    resources: { en: { translation: en }, pl: { translation: pl } },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}
