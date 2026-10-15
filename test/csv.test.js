import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, columnItems, serializeColumn, readCsvList, CSV_LIMITS } from "../src/csv.js";
import { reconcileItems, toCsv } from "../src/core.js";

test("CSV parses BOM, CRLF, Unicode, commas, escaped quotes and embedded line breaks", () => {
  const rows = parseCsv('\uFEFFname,note\r\n"Zoë, 李","said ""hello""\r\nnext line"\r\nend,last\r\n');
  assert.deepEqual(rows.map(r => r.cells), [["name", "note"], ["Zoë, 李", 'said "hello"\r\nnext line'], ["end", "last"]]);
  assert.deepEqual(rows.map(r => r.line), [1, 2, 4]);
});

test("header selection is explicit and duplicate/empty header names do not merge columns", () => {
  const rows = parseCsv('name,name,\na,b,c');
  assert.deepEqual(columnItems(rows, 1, false).map(x => x.value), ["name", "b"]);
  assert.deepEqual(columnItems(rows, 1, true).map(x => x.value), ["b"]);
  assert.deepEqual(columnItems(rows, 2, true).map(x => x.value), ["c"]);
  for (const column of [-1, 3, NaN, 1.5]) assert.throws(() => columnItems(rows, column), /available/);
});

test("column serialization preserves multiline cells and exact comparison boundaries", () => {
  const values = ['a,b', 'line 1\nline 2', '"quotes"', " trailing "];
  const a = readCsvList(serializeColumn(values.map(value => ({ value }))));
  assert.deepEqual(a.map(x => x.value), values);
  const result = reconcileItems(a, a, { trimSpace: false, collapseSpace: false, nearMatches: false });
  assert.equal(result.exact.length, 4);
  assert.equal(result.onlyA.length, 0);
  assert.throws(() => readCsvList('a,b'), /one column/);
});

for (const [label, input] of [["unterminated", '"a'], ["quote in plain cell", 'a"b,c'], ["junk after quote", '"a" x,b'], ["ragged rows", 'a,b\nc'], ["extra column", 'a\nb,c']]) {
  test(`CSV rejects ${label}`, () => assert.throws(() => parseCsv(input)));
}

test("CSV empty input, trailing delimiters and empty selected cells remain explicit", () => {
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("\uFEFF"), []);
  assert.deepEqual(parseCsv("a,"), [{ cells: ["a", ""], line: 1 }]);
  assert.deepEqual(readCsvList('""\n  \nx'), [{ value: "x", line: 3 }]);
});

test("CSV character, field, row and column limits fail at their boundaries", () => {
  assert.equal(parseCsv("a,b", { ...CSV_LIMITS, maxCharacters: 3 }).length, 1);
  assert.throws(() => parseCsv("a,bc", { ...CSV_LIMITS, maxCharacters: 3 }), /size/);
  assert.throws(() => parseCsv("abc", { ...CSV_LIMITS, maxField: 2 }), /field/);
  assert.throws(() => parseCsv("a\nb", { ...CSV_LIMITS, maxRows: 1 }), /records/);
  assert.throws(() => parseCsv("a,b", { ...CSV_LIMITS, maxColumns: 1 }), /columns/);
});

test("formula-like input stays literal in comparisons and is prefixed in report exports", () => {
  for (const value of ['=1+1', '+SUM(1,2)', '-12', '@x', '  =HYPERLINK("https://example.invalid")', '\tcommand', '\nvalue']) {
    const items = readCsvList(serializeColumn([{ value }]));
    assert.equal(items[0].value, value);
    const result = reconcileItems(items, items, { nearMatches: false });
    assert.equal(result.exact[0].a, value);
    const rows = parseCsv(toCsv(result));
    assert.equal(rows[1].cells[1], "'" + value);
    assert.equal(rows[1].cells[2], "'" + value);
  }
});
