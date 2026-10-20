import { parseList, reconcileItems, toCsv } from "./core.js";
import { parseCsv, columnItems, serializeColumn, readCsvList } from "./csv.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  listA: $("#list-a"), listB: $("#list-b"), countA: $("#count-a"), countB: $("#count-b"),
  results: $("#results"), summary: $("#summary-grid"), tabs: $("#tabs"), rows: $("#result-rows"), empty: $("#empty-result")
};
let current = null;
let activeGroup = "exact";
let pendingImport = null;
let importSequence = 0;
const importDialog = $("#csv-import");
const importStatus = $("#import-status");
$("#csv-column").addEventListener("change", renderImport);
$("#csv-header").addEventListener("change", renderImport);
$("#csv-apply").addEventListener("click", applyImport);
$("#csv-cancel").addEventListener("click", () => importDialog.close());
importDialog.addEventListener("close", () => { pendingImport = null; });
$("#mode-a").addEventListener("change", listChanged);
$("#mode-b").addEventListener("change", listChanged);

document.querySelectorAll(".option-grid input").forEach(input => input.addEventListener("change", invalidateResults));

$("#compare").addEventListener("click", compare);
$("#reset").addEventListener("click", reset);
$("#load-example").addEventListener("click", loadExample);
$("#export").addEventListener("click", exportCsv);
elements.listA.addEventListener("input", listChanged);
elements.listB.addEventListener("input", listChanged);
$("#file-a").addEventListener("change", (event) => importFile(event, elements.listA));
$("#file-b").addEventListener("change", (event) => importFile(event, elements.listB));

function options() {
  return {
    ignoreCase: $("#ignore-case").checked,
    trimSpace: $("#trim-space").checked,
    collapseSpace: $("#collapse-space").checked,
    ignorePunctuation: $("#ignore-punctuation").checked,
    removeNumbering: $("#remove-numbering").checked,
    nearMatches: $("#near-matches").checked
  };
}

function compare() {
  try { current = reconcileItems(readItems(elements.listA), readItems(elements.listB), options()); }
  catch (error) { invalidateResults(); importStatus.textContent = error.message; return; }
  importStatus.textContent = "";
  activeGroup = "exact";
  render();
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  const groups = [
    ["exact", "Exact", current.exact.length], ["normalized", "Normalized", current.normalized.length],
    ["possible", "Possible", current.possible.length], ["onlyA", "Only in A", current.onlyA.length], ["onlyB", "Only in B", current.onlyB.length],
    ["duplicatesA", "Duplicates in A", current.duplicatesA.length], ["duplicatesB", "Duplicates in B", current.duplicatesB.length]
  ];
  elements.summary.replaceChildren(...groups.map(([key, label, count]) => card(label, count, key)));
  elements.tabs.replaceChildren(...groups.map(([key, label, count]) => tab(label, count, key)));
  const items = current[activeGroup];
  const visible = activeGroup.startsWith("duplicates") ? items.map(item => ({
    a: activeGroup === "duplicatesA" ? item.value : "", b: activeGroup === "duplicatesB" ? item.value : "",
    kind: `${item.count} occurrences · lines ${item.lines.join(", ")}`
  })) : items;
  elements.rows.replaceChildren(...visible.map(row));
  elements.empty.hidden = items.length > 0;
}

function card(label, count, key) {
  const item = document.createElement("button");
  item.type = "button";
  item.className = "summary-card";
  item.innerHTML = `<strong>${count}</strong><span>${label}</span>`;
  item.addEventListener("click", () => { activeGroup = key; render(); });
  return item;
}

function tab(label, count, key) {
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-pressed", String(key === activeGroup));
  button.textContent = `${label} (${count})`;
  button.addEventListener("click", () => { activeGroup = key; render(); });
  return button;
}

function row(item) {
  const tr = document.createElement("tr");
  [item.a || "—", item.b || "—", item.kind === "Possible" ? `${Math.round(item.score * 100)}% similar · review required` : item.kind].forEach((value) => {
    const td = document.createElement("td");
    td.textContent = value;
    tr.appendChild(td);
  });
  return tr;
}

function modeFor(textarea) { return $(textarea === elements.listA ? "#mode-a" : "#mode-b"); }
function readItems(textarea) { return modeFor(textarea).value === "csv" ? readCsvList(textarea.value) : parseList(textarea.value); }
function invalidateResults() { current = null; elements.results.hidden = true; }
function listChanged() { importSequence += 1; invalidateResults(); updateCounts(); }
function cancelImport() { importSequence += 1; if (importDialog.open) importDialog.close(); pendingImport = null; }

async function importFile(event, textarea) {
  const input = event.target;
  const [file] = input.files;
  if (!file) return;
  const sequence = ++importSequence;
  const baseline = textarea.value, baselineMode = modeFor(textarea).value;
  try {
    if (file.size > 1048576) throw new Error("Import files must be at most 1 MiB.");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
    if (sequence !== importSequence) return;
    if (/\.csv$/i.test(file.name)) {
      const rows = parseCsv(text);
      if (!rows.length) throw new Error("The CSV file has no records.");
      pendingImport = { rows, textarea, baseline, baselineMode, sequence };
      $("#csv-filename").textContent = file.name;
      $("#csv-header").checked = false;
      $("#csv-column").value = "0";
      renderImport();
      if (!importDialog.open) importDialog.showModal();
    } else {
      textarea.value = text; modeFor(textarea).value = "lines";
      invalidateResults(); updateCounts(); importStatus.textContent = "Text file imported locally.";
    }
  } catch (error) {
    if (sequence === importSequence) importStatus.textContent = error.message;
  } finally { input.value = ""; }
}

function renderImport() {
  if (!pendingImport) return;
  const { rows } = pendingImport;
  const select = $("#csv-column"), header = $("#csv-header").checked;
  const previous = Number(select.value) || 0;
  select.replaceChildren(...rows[0].cells.map((value, index) => {
    const option = document.createElement("option"); option.value = String(index);
    option.textContent = `Column ${index + 1}${header ? ": " + (value || "(unnamed)") : ""}`;
    return option;
  }));
  select.value = String(Math.min(previous, rows[0].cells.length - 1));
  const column = Number(select.value);
  $("#csv-preview").replaceChildren(...rows.slice(header ? 1 : 0).slice(0, 5).map(row => {
    const tr = document.createElement("tr");
    for (const value of [String(row.line), row.cells[column]]) {
      const cell = document.createElement("td"); cell.textContent = value; tr.appendChild(cell);
    }
    return tr;
  }));
  const count = columnItems(rows, column, header).length;
  $("#csv-summary").textContent = `${count} non-empty cells to import. Preview shows up to five records; quoted line breaks stay inside one item.`;
  $("#csv-apply").disabled = count === 0;
}

function applyImport() {
  if (!pendingImport) return;
  const { rows, textarea, baseline, baselineMode, sequence } = pendingImport;
  if (sequence !== importSequence || textarea.value !== baseline || modeFor(textarea).value !== baselineMode) {
    importStatus.textContent = "The list changed during import. Choose the file again."; importDialog.close(); return;
  }
  const items = columnItems(rows, Number($("#csv-column").value), $("#csv-header").checked);
  if (!items.length) return;
  textarea.value = serializeColumn(items); modeFor(textarea).value = "csv";
  invalidateResults(); updateCounts(); importDialog.close();
  importStatus.textContent = `Imported ${items.length} CSV cells locally. CSV cell mode preserves quoted commas and line breaks; editing remains available.`;
}

function exportCsv() {
  if (!current) return;
  const blob = new Blob([toCsv(current)], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "list-reconciliation.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function reset() {
  cancelImport(); modeFor(elements.listA).value = "lines"; modeFor(elements.listB).value = "lines"; importStatus.textContent = "";
  elements.listA.value = "";
  elements.listB.value = "";
  current = null;
  elements.results.hidden = true;
  updateCounts();
  elements.listA.focus();
}

function loadExample() {
  cancelImport(); modeFor(elements.listA).value = "lines"; modeFor(elements.listB).value = "lines"; invalidateResults();
  elements.listA.value = "Acme Corporation\njohn@example.com\nBetter-Proxies\nNorthwind Traders\nNorthwind Traders";
  elements.listB.value = "Acme Corporation\nJohn@example.com\nBetter Proxies\nNorthwind Trading";
  $("#ignore-punctuation").checked = true;
  updateCounts();
}

function updateCounts() {
  for (const [textarea, counter] of [[elements.listA, elements.countA], [elements.listB, elements.countB]]) {
    try { counter.textContent = `${readItems(textarea).length} non-empty ${modeFor(textarea).value === "csv" ? "CSV cells" : "lines"}`; }
    catch (error) { counter.textContent = error.message; }
  }
}

updateCounts();
