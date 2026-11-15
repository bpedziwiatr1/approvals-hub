import { createInstance, type i18n } from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import pl from "./pl.json";

export type Lang = "en" | "pl";

export function resolveLang(search: string): Lang {
  const lang = new URLSearchParams(search).get("lang");
  return lang === "pl" ? "pl" : "en";
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
