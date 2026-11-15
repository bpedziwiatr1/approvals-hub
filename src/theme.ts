import { webDarkTheme, webLightTheme, type Theme } from "@fluentui/react-components";

export type ThemeName = "light" | "dark";

export function resolveTheme(search: string, systemPrefersDark: boolean): ThemeName {
  const theme = new URLSearchParams(search).get("theme");
  if (theme === "dark" || theme === "light") return theme;
  return systemPrefersDark ? "dark" : "light";
}

export function fluentTheme(name: ThemeName): Theme {
  return name === "dark" ? webDarkTheme : webLightTheme;
}
