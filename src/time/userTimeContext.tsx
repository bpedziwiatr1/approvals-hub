import { createContext, useContext, useMemo, type ReactNode } from "react";
import { formatInUserTime } from "./userTime";

interface UserTime {
  /** Minutes to add to UTC to get the user's local time. */
  offsetMinutes: number;
  /** An ISO instant as date and time in the user's time zone and language format. */
  format: (iso: string) => string;
}

const UserTimeContext = createContext<UserTime>({ offsetMinutes: 0, format: (iso) => formatInUserTime(iso, "en", 0) });

export function UserTimeProvider({ lang, offsetMinutes, children }: { lang: string; offsetMinutes: number; children: ReactNode }) {
  const value = useMemo<UserTime>(() => ({ offsetMinutes, format: (iso) => formatInUserTime(iso, lang, offsetMinutes) }), [lang, offsetMinutes]);
  return <UserTimeContext.Provider value={value}>{children}</UserTimeContext.Provider>;
}

export const useUserTime = () => useContext(UserTimeContext);
