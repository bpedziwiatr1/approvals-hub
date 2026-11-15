import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
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

test("stagePage puts the built page into a staging copy and leaves the tracked solution untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "ah-solution-"));
  mkdirSync(join(root, "dist"));
  writeFileSync(join(root, "dist/index.html"), "<html>built</html>");
  const trackedPage = join(root, "solution", WEB_RESOURCE_PATH);
  mkdirSync(dirname(trackedPage), { recursive: true });
  writeFileSync(trackedPage, "<html>placeholder</html>");
  writeFileSync(join(root, "solution/src/Other.txt"), "other");
  const staged = stagePage({ distHtml: join(root, "dist/index.html"), solutionDir: join(root, "solution"), stagingDir: join(root, "out/staging") });
  assert.equal(readFileSync(join(staged, WEB_RESOURCE_PATH.replace(/^src\//, "")), "utf8"), "<html>built</html>");
  assert.equal(readFileSync(join(staged, "Other.txt"), "utf8"), "other");
  assert.equal(readFileSync(trackedPage, "utf8"), "<html>placeholder</html>");
});

test("stagePage fails clearly when the page was not built", () => {
  const root = mkdtempSync(join(tmpdir(), "ah-solution-"));
  assert.throws(() => stagePage({ distHtml: join(root, "dist/index.html"), solutionDir: join(root, "solution"), stagingDir: join(root, "out/staging") }), /npm run build/);
});

test("release artifacts are named ApprovalsHub_<version>_<kind>.zip", () => {
  assert.equal(artifactName("1.2.3", "managed"), "ApprovalsHub_1.2.3_managed.zip");
  assert.equal(artifactName("1.2.3", "unmanaged"), "ApprovalsHub_1.2.3_unmanaged.zip");
});

test("the solution has a web resource, an environment variable, an app with its sitemap, and no security roles (ADR 0003)", () => {
  const types = rootComponentTypes(readFileSync(join(SOLUTION_DIR, "src/Other/Solution.xml"), "utf8"));
  assert.deepEqual([...types].sort((a, b) => a - b), [61, 62, 80, 380]);
  assert.equal(existsSync(join(SOLUTION_DIR, "src/Roles")), false);
});

const src = join(SOLUTION_DIR, "src");
const rootComponents = (xml) => [...xml.matchAll(/<RootComponent\b([^>]*)\/>/g)].map((m) => ({ type: Number(/type="(\d+)"/.exec(m[1])[1]), name: /schemaName="([^"]+)"/.exec(m[1])?.[1] }));

test("every root component has its unpacked definition", () => {
  const roots = rootComponents(readFileSync(join(src, "Other/Solution.xml"), "utf8"));
  for (const { type, name } of roots) {
    const file = { 61: `WebResources/${name}.data.xml`, 62: `AppModuleSiteMaps/${name}/AppModuleSiteMap.xml`, 80: `AppModules/${name}/AppModule.xml`, 380: `environmentvariabledefinitions/${name}/environmentvariabledefinition.xml` }[type];
    assert.ok(file && existsSync(join(src, file)), `root component ${type} ${name} has no definition file`);
  }
});

test("the environment variable ships the default profile as its default value", () => {
  const xml = readFileSync(join(src, "environmentvariabledefinitions/bpt_ApprovalsHubConfig/environmentvariabledefinition.xml"), "utf8");
  assert.match(xml, /<defaultvalue>\{"profiles":\{"default":/);
});

test("the sitemap has one entry to the page with the default profile and the icon", () => {
  const xml = readFileSync(join(src, "AppModuleSiteMaps/bpt_ApprovalsHub/AppModuleSiteMap.xml"), "utf8");
  assert.equal([...xml.matchAll(/<SubArea\b/g)].length, 1);
  assert.match(xml, /Url="\$webresource:bpt_\/approvalshub\/index\.html\?data=profile%3Ddefault"/);
  assert.match(xml, /Icon="\$webresource:bpt_\/approvalshub\/icon\.svg"/);
});

test("the app module lists its sitemap as a component and the sitemap has a name", () => {
  const app = readFileSync(join(src, "AppModules/bpt_ApprovalsHub/AppModule.xml"), "utf8");
  assert.match(app, /<AppModuleComponent type="62" schemaName="bpt_ApprovalsHub" \/>/);
  const map = readFileSync(join(src, "AppModuleSiteMaps/bpt_ApprovalsHub/AppModuleSiteMap.xml"), "utf8");
  assert.match(map, /<SiteMapName>bpt_ApprovalsHub<\/SiteMapName>/);
});

const hasPac = spawnSync("pac", ["help"], { shell: true }).status === 0;
test("pac packs the solution with every component in the zip and unpacks it again", { skip: !hasPac && "pac is not installed" }, () => {
  const root = mkdtempSync(join(tmpdir(), "ah-pac-"));
  const zip = join(root, "s.zip");
  const pack = spawnSync("pac", ["solution", "pack", "--zipfile", zip, "--folder", src, "--packagetype", "Unmanaged", "--errorlevel", "Warning"], { shell: true, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stdout + pack.stderr);
  // Known pac quirk: it cannot see sharded environment variable definitions when validating root components, although it packs them (verified by the unpack below).
  const warnings = pack.stdout.split(/\r?\n/).filter((l) => /Type='/.test(l) && !/EnvironmentVariableDefinition/.test(l));
  assert.deepEqual(warnings, [], pack.stdout);
  const out = join(root, "un");
  const unpack = spawnSync("pac", ["solution", "unpack", "--zipfile", zip, "--folder", out, "--packagetype", "Unmanaged"], { shell: true, encoding: "utf8" });
  assert.equal(unpack.status, 0, unpack.stdout + unpack.stderr);
  for (const f of ["WebResources/bpt_/approvalshub/index.html.data.xml", "WebResources/bpt_/approvalshub/icon.svg.data.xml", "AppModules/bpt_ApprovalsHub/AppModule.xml", "AppModuleSiteMaps/bpt_ApprovalsHub/AppModuleSiteMap.xml", "environmentvariabledefinitions/bpt_ApprovalsHubConfig/environmentvariabledefinition.xml"]) {
    assert.ok(existsSync(join(out, f)), `${f} is missing after the round trip`);
  }
});
