import { webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";

export type ThemeName = "light" | "dark";

export function resolveTheme(search: string, systemPrefersDark: boolean): ThemeName {
  const theme = new URLSearchParams(search).get("theme");
  if (theme === "dark" || theme === "light") return theme;
  return systemPrefersDark ? "dark" : "light";
}

/** The Fluent theme for `name`; a Profile's accent colour replaces the brand colours. */
export function fluentTheme(name: ThemeName, accentColor?: string | null): Theme {
  const base = name === "dark" ? webDarkTheme : webLightTheme;
  if (!accentColor) return base;
  return {
    ...base,
    colorBrandBackground: accentColor,
    colorBrandBackgroundHover: accentColor,
    colorBrandBackgroundPressed: accentColor,
    colorBrandBackgroundSelected: accentColor,
    colorCompoundBrandBackground: accentColor,
    colorCompoundBrandBackgroundHover: accentColor,
    colorCompoundBrandBackgroundPressed: accentColor,
    colorCompoundBrandStroke: accentColor,
    colorBrandStroke1: accentColor,
    colorBrandForeground1: accentColor,
    colorBrandForegroundLink: accentColor,
  };
}
