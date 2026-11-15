import { test } from "node:test";
import assert from "node:assert/strict";
import { parseDenylist, scanText } from "./check-leaks.mjs";

// Samples are assembled at runtime so this file does not trip the scanner it tests.
const realGuid = ["11111111", "2222", "3333", "4444", "555555555555"].join("-");
const syntheticGuid = ["00000000", "0000", "4000", "8000", "000000000001"].join("-");
const orgHost = "https://" + ["acme", "crm4", "dynamics", "com"].join(".") + "/main.aspx";
const contosoHost = "https://" + ["contoso", "crm", "dynamics", "com"].join(".") + "/main.aspx";
const realEmail = ["jan", "corp.pl"].join("@");
const exampleEmail = ["user1", "example.com"].join("@");

const rules = (text, deny) => scanText(text, deny).map(f => f.rule);

test("flags a GUID that is not synthetic and accepts the synthetic range", () => {
  assert.deepEqual(rules(`id=${realGuid}`), ["non-synthetic GUID"]);
  assert.deepEqual(rules(`id=${syntheticGuid}`), []);
});

test("flags Dataverse org hosts other than contoso", () => {
  assert.equal(rules(`open ${orgHost}`).length, 1);
  assert.deepEqual(rules(`open ${contosoHost}`), []);
});

test("flags e-mails outside example domains", () => {
  assert.equal(rules(`mail ${realEmail}`).length, 1);
  assert.deepEqual(rules(`mail ${exampleEmail}`), []);
});

test("does not mistake package versions or OData annotations for e-mails", () => {
  assert.deepEqual(rules("react@18.3.1 and typescript@5.6.2"), []);
  assert.deepEqual(rules('"_ownerid_value@OData.Community.Display.V1.FormattedValue"'), []);
});

test("allows Microsoft service addresses quoted from Microsoft docs", () => {
  assert.deepEqual(rules(["svc", "microsoft.com"].join("@")), []);
});

test("matches private denylist terms case-insensitively without echoing them", () => {
  const found = scanText("Some ACMECORP text", parseDenylist("# comment\n\nacmecorp\n"));
  assert.deepEqual(found, [{ line: 1, rule: "private denylist entry 1" }]);
});

test("reports the line number", () => {
  assert.equal(scanText(`ok\nok\nid=${realGuid}`)[0].line, 3);
});
