import assert from "node:assert/strict";
import { test } from "node:test";
import { findExternalReferences } from "./check-dist.mjs";

test("accepts a fully inline page", () => {
  assert.deepEqual(findExternalReferences("<html><script>var a=1</script><style>a{}</style></html>"), []);
});

test("rejects external script src, link href and CDN imports", () => {
  assert.equal(findExternalReferences('<script src="app.js"></script>').length, 1);
  assert.equal(findExternalReferences('<link rel="stylesheet" href="a.css">').length, 1);
  assert.equal(findExternalReferences('<script>import("https://cdn.example.com/x.js")</script>').length, 1);
  assert.equal(findExternalReferences("<style>@import url(https://cdn.example.com/a.css);</style>").length, 1);
});

test("allows data: links such as an inline favicon", () => {
  assert.deepEqual(findExternalReferences('<link rel="icon" href="data:,">'), []);
});
