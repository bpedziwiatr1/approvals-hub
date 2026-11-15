import type { ApprovalListItem } from "../data/dataClient";

const HEADER = ["Title", "Status", "Outcome", "Created on"];

/** RFC 4180 field: quoted when it holds a comma, a double quote or a line break; embedded quotes doubled. */
function field(value: string | null): string {
  if (value === null) return "";
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Approvals as CSV with a header row; rows end with CRLF. Status is the stable status key (pending, completed, ...). */
export function toCsv(items: ApprovalListItem[]): string {
  const lines = [HEADER, ...items.map((i) => [i.title, i.status, i.outcome, i.createdOn])];
  return lines.map((line) => line.map(field).join(",")).join("\r\n") + "\r\n";
}

/** Saves CSV text as a file. A UTF-8 byte order mark lets spreadsheet apps read Polish letters. */
export function downloadCsv(csv: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
