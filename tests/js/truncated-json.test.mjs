// Imports the real looksLikeTruncatedModelJson from api.js via a query-stripping loader
// (offline: the CDN supabase import is mapped to the installed npm package).
import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./support/strip-query.mjs", import.meta.url);
const { looksLikeTruncatedModelJson } = await import("../../src/js/api.js");

const long = (n) => "x".repeat(n);

test("empty or non-JSON text is not truncated", () => {
  assert.equal(looksLikeTruncatedModelJson(""), false);
  assert.equal(looksLikeTruncatedModelJson(null), false);
  assert.equal(looksLikeTruncatedModelJson(long(500)), false);
});

test("valid JSON (object, array, fenced) is not truncated", () => {
  assert.equal(looksLikeTruncatedModelJson('{"a":1}'), false);
  assert.equal(looksLikeTruncatedModelJson("[1,2,3]"), false);
  assert.equal(looksLikeTruncatedModelJson('```json\n{"a":1}\n```'), false);
  assert.equal(looksLikeTruncatedModelJson(`{"a":"${long(500)}"}`), false);
});

test("unparseable JSON-like text longer than 200 chars is truncated", () => {
  assert.equal(looksLikeTruncatedModelJson(`{"a":"${long(300)}`), true);
  assert.equal(looksLikeTruncatedModelJson(`[{"a":"${long(300)}"},`), true);
  assert.equal(looksLikeTruncatedModelJson('```json\n{"a":"' + long(300)), true);
});

test("short unparseable JSON-like text is PARSE_ERROR territory, not truncated", () => {
  assert.equal(looksLikeTruncatedModelJson('{"a":'), false);
  assert.equal(looksLikeTruncatedModelJson("{not json}"), false);
});
