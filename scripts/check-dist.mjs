#!/usr/bin/env node
// Fails when dist is not exactly one self-contained index.html.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_SRC = /<script\b[^>]*\bsrc\s*=/gi;
const LINK_HREF = /<link\b[^>]*\bhref\s*=\s*(?!["']?data:)/gi;
const CDN_IMPORT = /(?:\bimport\s*\(\s*|\bfrom\s*|@import\s+(?:url\()?\s*)["']?https?:\/\//gi;

export function findExternalReferences(html) {
  const found = [];
  for (const [re, rule] of [[SCRIPT_SRC, "external <script src>"], [LINK_HREF, "external <link href>"], [CDN_IMPORT, "CDN import"]]) {
    found.push(...Array.from(html.matchAll(re), () => rule));
  }
  return found;
}

function main() {
  const dist = resolve(process.argv[2] ?? "dist");
  if (!existsSync(dist)) return fail(`${dist} does not exist; run npm run build first`);
  const files = readdirSync(dist, { recursive: true }).map(String);
  if (files.length !== 1 || files[0] !== "index.html") return fail(`dist must contain only index.html, found: ${files.join(", ")}`);
  const findings = findExternalReferences(readFileSync(resolve(dist, "index.html"), "utf8"));
  if (findings.length) return fail(`dist/index.html is not self-contained: ${[...new Set(findings)].join(", ")}`);
  console.log("check-dist: ok (single self-contained index.html)");
}

function fail(msg) {
  console.error(`check-dist: ${msg}`);
  process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
