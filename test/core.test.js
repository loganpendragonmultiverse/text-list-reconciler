import test from "node:test";
import assert from "node:assert/strict";
import { normalize, parseList, reconcile, similarity, toCsv } from "../src/core.js";

test("parseList preserves source line numbers", () => {
  assert.deepEqual(parseList("alpha\n\nbeta\n").map((item) => item.line), [1, 3]);
});

test("normalization options remain explicit", () => {
  assert.equal(normalize(" 01. Better-Proxies ", { removeNumbering: true, ignorePunctuation: true }), "better proxies");
  assert.equal(normalize("A-B", { ignorePunctuation: false }), "a-b");
});

test("reconciliation separates exact normalized possible and missing", () => {
  const result = reconcile("Acme\nJohn@example.com\nNorthwind Traders\nZulu", "Acme\njohn@example.com\nNorthwind Trading\nQuartz", { nearMatches: true });
  assert.equal(result.exact.length, 1);
  assert.equal(result.normalized.length, 1);
  assert.equal(result.possible.length, 1);
  assert.equal(result.onlyA.length, 1);
  assert.equal(result.onlyB.length, 1);
});

test("duplicate values are reported without disappearing", () => {
  const result = reconcile("alpha\nalpha", "alpha", {});
  assert.equal(result.duplicatesA[0].count, 2);
  assert.equal(result.exact.length, 1);
  assert.equal(result.onlyA.length, 1);
});

test("short unrelated values are not suggested as near matches", () => {
  assert.ok(similarity("cat", "car") < 0.9);
  assert.equal(reconcile("cat", "car", {}).possible.length, 0);
});

test("CSV output escapes user values", () => {
  const csv = toCsv(reconcile('"quoted"', '"quoted"', {}));
  assert.match(csv, /"""quoted"""/);
});
