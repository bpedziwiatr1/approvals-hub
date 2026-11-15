import { describe, expect, it } from "vitest";
import { buildApprovalListItem } from "../data/factories";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("writes a header row and one row per Approval with title, status, outcome and created on", () => {
    const csv = toCsv([
      buildApprovalListItem({ id: "00000000-0000-0000-0000-00000000c001", title: "Contoso order", status: "approved", outcome: null, createdOn: "2025-03-01T10:00:00Z" }),
      buildApprovalListItem({ id: "00000000-0000-0000-0000-00000000c002", title: "Contoso return", status: "completed", outcome: "Send back", createdOn: "2025-03-02T10:00:00Z" }),
    ]);

    expect(csv).toBe(["Title,Status,Outcome,Created on", "Contoso order,approved,,2025-03-01T10:00:00Z", "Contoso return,completed,Send back,2025-03-02T10:00:00Z"].join("\r\n") + "\r\n");
  });

  it("writes only the header when there are no Approvals", () => {
    expect(toCsv([])).toBe("Title,Status,Outcome,Created on\r\n");
  });

  it.each([
    ["a comma", "Invoice 1, urgent", '"Invoice 1, urgent"'],
    ["a double quote", 'Say "yes"', '"Say ""yes"""'],
    ["a line feed", "line one\nline two", '"line one\nline two"'],
    ["a carriage return", "a\rb", '"a\rb"'],
    ["a comma and a quote", 'a,"b"', '"a,""b"""'],
  ])("quotes a title with %s and doubles embedded quotes", (_, title, escaped) => {
    const csv = toCsv([buildApprovalListItem({ title, status: "pending", outcome: null })]);
    expect(csv.split("\r\n")[1].startsWith(`${escaped},pending,`)).toBe(true);
    expect(csv.slice("Title,Status,Outcome,Created on\r\n".length).startsWith(escaped)).toBe(true);
  });

  it("quotes an Outcome that contains a comma", () => {
    const csv = toCsv([buildApprovalListItem({ status: "completed", outcome: "Approve, with notes", createdOn: "2025-01-01T00:00:00Z" })]);
    expect(csv.split("\r\n")[1]).toContain(',"Approve, with notes",');
  });
});
