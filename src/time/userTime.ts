const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * Created-on bounds for a range of the user's calendar days (`YYYY-MM-DD`), both ends inclusive, as UTC instants.
 * `offsetMinutes` is the user's UTC offset: minutes to add to UTC to get their local time.
 */
export function userDayRange(range: { from?: string; to?: string }, offsetMinutes: number): { createdFrom?: string; createdTo?: string } {
  const startOfDay = (day: string) => Date.parse(`${day}T00:00:00Z`) - offsetMinutes * MINUTE;
  return {
    ...(range.from ? { createdFrom: new Date(startOfDay(range.from)).toISOString() } : {}),
    ...(range.to ? { createdTo: new Date(startOfDay(range.to) + DAY - 1).toISOString() } : {}),
  };
}

/** The browser's own UTC offset, the best guess when the user's Dataverse time zone cannot be read. */
export const browserOffsetMinutes = () => -new Date().getTimezoneOffset();

/** Date and time of an instant as the user reads it: their UTC offset, the date format of their language. */
export function formatInUserTime(iso: string, lang: string, offsetMinutes: number): string {
  const shifted = new Date(Date.parse(iso) + offsetMinutes * MINUTE);
  return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(shifted);
}
