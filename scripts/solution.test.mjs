import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { SOLUTION_DIR, WEB_RESOURCE_PATH, artifactName, packageVersion, rootComponentTypes, solutionVersion, stagePage } from "./solution.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

test("reads the version from Solution.xml and package.json", () => {
  assert.equal(solutionVersion("<ImportExportXml><SolutionManifest><Version>1.2.3</Version></SolutionManifest></ImportExportXml>"), "1.2.3");
  assert.equal(packageVersion('{"version":"4.5.6"}'), "4.5.6");
});

test("the solution version equals the package.json version", () => {
  const fromSolution = solutionVersion(readFileSync(join(SOLUTION_DIR, "src/Other/Solution.xml"), "utf8"));
  assert.equal(fromSolution, packageVersion(readFileSync("package.json", "utf8")));
});

test("stagePage copies the built page into the web resource", () => {
  const root = mkdtempSync(join(tmpdir(), "ah-solution-"));
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist/index.html"), "<html>built</html>");
  stagePage({ distHtml: join(root, "dist/index.html"), solutionDir: join(root, "solution") });
  assert.equal(readFileSync(join(root, "solution", WEB_RESOURCE_PATH), "utf8"), "<html>built</html>");
});

test("stagePage fails clearly when the page was not built", () => {
  const root = mkdtempSync(join(tmpdir(), "ah-solution-"));
  assert.throws(() => stagePage({ distHtml: join(root, "dist/index.html"), solutionDir: join(root, "solution") }), /npm run build/);
});

test("release artifacts are named ApprovalsHub_<version>_<kind>.zip", () => {
  assert.equal(artifactName("1.2.3", "managed"), "ApprovalsHub_1.2.3_managed.zip");
  assert.equal(artifactName("1.2.3", "unmanaged"), "ApprovalsHub_1.2.3_unmanaged.zip");
});

test("the solution has a web resource, an environment variable and an app, and no security roles (ADR 0003)", () => {
  const types = rootComponentTypes(readFileSync(join(SOLUTION_DIR, "src/Other/Solution.xml"), "utf8"));
  assert.deepEqual([...types].sort((a, b) => a - b), [61, 80, 380]);
  assert.equal(existsSync(join(SOLUTION_DIR, "src/Roles")), false);
});
