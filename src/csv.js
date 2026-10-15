import { csvCell } from "./core.js";

export const CSV_LIMITS = Object.freeze({ maxCharacters: 1048576, maxRows: 10000, maxColumns: 128, maxField: 65536 });

export function parseCsv(input, limits = CSV_LIMITS) {
  if (typeof input !== "string" || input.length > limits.maxCharacters) throw new Error("CSV exceeds the input size limit.");
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let cells = [], field = "", state = "start", line = 1, recordLine = 1;
  function finishField() {
    cells.push(field);
    if (cells.length > limits.maxColumns) throw new Error("CSV has too many columns.");
    field = ""; state = "start";
  }
  function finishRecord() {
    finishField();
    if (rows.length && cells.length !== rows[0].cells.length) throw new Error(`CSV record at line ${recordLine} has a different column count.`);
    rows.push({ cells, line: recordLine });
    if (rows.length > limits.maxRows) throw new Error("CSV has too many records.");
    cells = [];
  }
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (state === "quoted") {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else state = "closed";
      } else {
        field += char;
        if (char === "\r") { if (text[i + 1] === "\n") { field += "\n"; i += 1; } line += 1; }
        else if (char === "\n") line += 1;
      }
    } else if (char === ",") finishField();
    else if (char === "\r" || char === "\n") {
      finishRecord();
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      line += 1; recordLine = line;
    } else if (char === '"' && state === "start") state = "quoted";
    else if (state === "closed" || char === '"') throw new Error(`Invalid CSV quoting at line ${line}.`);
    else { field += char; state = "plain"; }
    if (field.length > limits.maxField) throw new Error("CSV field exceeds the size limit.");
  }
  if (state === "quoted") throw new Error("CSV has an unterminated quoted field.");
  if (field || cells.length || state !== "start") finishRecord();
  return rows;
}

export function columnItems(rows, column, header = false) {
  if (!Number.isInteger(column) || column < 0 || !rows.length || column >= rows[0].cells.length) throw new Error("Choose an available CSV column.");
  return rows.slice(header ? 1 : 0).map(row => ({ value: row.cells[column], line: row.line })).filter(item => item.value.trim());
}

export function serializeColumn(items) {
  return items.map(item => csvCell(item.value)).join("\r\n");
}

export function readCsvList(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  if (rows[0].cells.length !== 1) throw new Error("CSV cell mode needs one column. Use Import file to choose a column.");
  return columnItems(rows, 0);
}
