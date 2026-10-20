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


test("all exact matches are reserved before normalized matches", () => {
  const result = reconcile("ALPHA\nalpha", "alpha", { nearMatches: false });
  assert.equal(result.exact[0].a, "alpha");
  assert.equal(result.normalized.length, 0);
  assert.equal(result.onlyA[0].a, "ALPHA");
});

test("plain input preserves trailing whitespace for exact evidence", () => {
  assert.equal(parseList("alpha  ")[0].value, "alpha  ");
  const result = reconcile("alpha  ", "alpha", { trimSpace: false, collapseSpace: false, nearMatches: false });
  assert.equal(result.exact.length, 0);
  assert.equal(result.normalized.length, 0);
  assert.equal(result.onlyA[0].a, "alpha  ");
});

test("CSV exports duplicate groups and their source lines", () => {
  const csv = toCsv(reconcile("=x\n=x", "z", { nearMatches: false }));
  assert.match(csv, /duplicatesA,'=x,,1; 2,,,2/);
});

test("near-match budgets reject incomplete comparison clearly", () => {
  const a = Array.from({length: 400}, (_, i) => `aaa${i}`).join("\n");
  const b = Array.from({length: 400}, (_, i) => `bbb${i}`).join("\n");
  assert.throws(() => reconcile(a, b), /Disable near-matches/);
  assert.equal(reconcile(a, b, {nearMatches: false}).onlyA.length, 400);
  assert.throws(() => reconcile("a".repeat(2000), "b".repeat(2000)), /work limit/);
});

test("punctuation-only normalized empties never become near matches", () => {
  const result = reconcile("---", "!!!", {ignorePunctuation: true});
  assert.equal(result.possible.length, 0);
  assert.equal(result.onlyA.length, 1);
});


test("plain text handles CR line endings and input limits", () => {
  assert.deepEqual(parseList("a\rb\r\nc").map(item => item.line), [1, 2, 3]);
  assert.throws(() => parseList("a".repeat(1048577)), /characters/);
  assert.throws(() => reconcile("x\n".repeat(10001), ""), /10,000 items/);
});


test("collapse spaces does not silently enable outer trimming", () => {
  assert.equal(normalize("  alpha  ", {trimSpace: false, collapseSpace: true}), " alpha ");
  assert.equal(normalize("alpha!", {ignorePunctuation: true}), "alpha");
});
