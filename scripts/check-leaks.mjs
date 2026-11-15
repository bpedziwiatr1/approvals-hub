#!/usr/bin/env node
// Fails when files in this repo contain data that could identify a customer environment.
// Rules: non-synthetic GUIDs, Dataverse org hosts other than contoso, e-mails outside example domains,
// and (optionally) entries from a private denylist kept outside the repo.
// Private denylist: $LEAK_DENYLIST, else .specs/denylist.txt (one case-insensitive term per line, # comments).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const GUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const SYNTHETIC_GUID = /^00000000-0000-/i;
const ORG_HOST = /\b([a-z0-9-]+\.crm\d*\.(?:dynamics\.com|microsoftdynamics\.(?:com|us|de)))\b/gi;
const EMAIL = /[\w.+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;
const ALLOWED_EMAIL_DOMAIN = /^(example\.(com|org|net)|users\.noreply\.github\.com|noreply\.github\.com|microsoft\.com$|odata\.|microsoft\.dynamics\.)/i;
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".zip", ".pdf"]);
const SKIP_FILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/;
const MAX_BYTES = 2_000_000;

export function parseDenylist(text) {
  return text.split(/\r?\n/).map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith("#"));
}

/** Returns findings as { line, rule }. Never includes the matched text, so logs stay clean. */
export function scanText(text, denylist = []) {
  const findings = [];
  text.split(/\r?\n/).forEach((line, i) => {
    const n = i + 1;
    for (const m of line.matchAll(GUID)) if (!SYNTHETIC_GUID.test(m[0])) findings.push({ line: n, rule: "non-synthetic GUID" });
    for (const m of line.matchAll(ORG_HOST)) if (m[1].toLowerCase() !== "contoso.crm.dynamics.com") findings.push({ line: n, rule: "Dataverse environment host other than contoso" });
    for (const m of line.matchAll(EMAIL)) if (!ALLOWED_EMAIL_DOMAIN.test(m[1])) findings.push({ line: n, rule: "e-mail outside example domains" });
    const lower = line.toLowerCase();
    denylist.forEach((term, k) => { if (lower.includes(term)) findings.push({ line: n, rule: `private denylist entry ${k + 1}` }); });
  });
  return findings;
}

function loadDenylist() {
  const path = process.env.LEAK_DENYLIST || ".specs/denylist.txt";
  if (!existsSync(path)) { console.log("check-leaks: no private denylist found (fine in CI)"); return []; }
  const list = parseDenylist(readFileSync(path, "utf8"));
  console.log(`check-leaks: private denylist with ${list.length} entries`);
  return list;
}

function main() {
  const denylist = loadDenylist();
  const files = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { encoding: "utf8" })
    .split("\0").filter(Boolean);
  let total = 0;
  for (const f of files) {
    if (SKIP_EXT.has(extname(f).toLowerCase()) || SKIP_FILE.test(f) || !existsSync(f)) continue;
    const st = statSync(f);
    if (!st.isFile() || st.size > MAX_BYTES) continue;
    const text = readFileSync(f, "utf8");
    if (text.includes("\0")) continue;
    for (const x of scanText(text, denylist)) { console.log(`${f}:${x.line}  ${x.rule}`); total++; }
  }
  if (total) { console.error(`check-leaks: ${total} finding(s). Replace with synthetic values (00000000-0000-..., contoso, example.com).`); process.exit(1); }
  console.log(`check-leaks: ${files.length} files clean`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
