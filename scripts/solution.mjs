#!/usr/bin/env node
// Helpers for the unpacked Dataverse solution in solution/ (used by build-solution.ps1/.sh and the tests).
//   node scripts/solution.mjs check   fails unless the solution version equals the package.json version
//   node scripts/solution.mjs stage   copies dist/index.html into the solution's web resource
//   node scripts/solution.mjs name <managed|unmanaged>   prints the release artifact file name
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const SOLUTION_DIR = "solution";
export const WEB_RESOURCE_PATH = "src/WebResources/bpt_/approvalshub/index.html";

export function solutionVersion(solutionXml) {
  const match = /<SolutionManifest>[\s\S]*?<Version>([^<]+)<\/Version>/.exec(solutionXml);
  if (!match) throw new Error("Solution.xml has no <Version>.");
  return match[1].trim();
}

export function packageVersion(packageJson) {
  return JSON.parse(packageJson).version;
}

export function artifactName(version, kind) {
  return `ApprovalsHub_${version}_${kind}.zip`;
}

/** The numeric component types of the solution's root components (61 web resource, 80 app, 380 environment variable definition, 20 role). */
export function rootComponentTypes(solutionXml) {
  return new Set([...solutionXml.matchAll(/<RootComponent\b[^>]*\btype="(\d+)"/g)].map((m) => Number(m[1])));
}

export function stagePage({ distHtml = "dist/index.html", solutionDir = SOLUTION_DIR } = {}) {
  if (!existsSync(distHtml)) throw new Error(`${distHtml} not found; run "npm run build" first.`);
  const target = join(solutionDir, WEB_RESOURCE_PATH);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(distHtml, target);
  return target;
}

function main(command, arg) {
  if (command === "check") {
    const fromSolution = solutionVersion(readFileSync(join(SOLUTION_DIR, "src/Other/Solution.xml"), "utf8"));
    const fromPackage = packageVersion(readFileSync("package.json", "utf8"));
    if (fromSolution !== fromPackage) throw new Error(`Solution version ${fromSolution} differs from package.json version ${fromPackage}.`);
    console.log(`Solution version ${fromSolution} matches package.json.`);
  } else if (command === "stage") {
    console.log(`Copied the page to ${stagePage()}`);
  } else if (command === "name") {
    if (arg !== "managed" && arg !== "unmanaged") throw new Error("Usage: solution.mjs name <managed|unmanaged>");
    console.log(artifactName(packageVersion(readFileSync("package.json", "utf8")), arg));
  } else {
    throw new Error("Usage: solution.mjs <check|stage|name>");
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv[2], process.argv[3]);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
