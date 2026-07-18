import { parseList, reconcile, toCsv } from "./core.js";

const $ = (selector) => document.querySelector(selector);
const elements = {
  listA: $("#list-a"), listB: $("#list-b"), countA: $("#count-a"), countB: $("#count-b"),
  results: $("#results"), summary: $("#summary-grid"), tabs: $("#tabs"), rows: $("#result-rows"), empty: $("#empty-result")
};
let current = null;
let activeGroup = "exact";

$("#compare").addEventListener("click", compare);
$("#reset").addEventListener("click", reset);
$("#load-example").addEventListener("click", loadExample);
$("#export").addEventListener("click", exportCsv);
elements.listA.addEventListener("input", updateCounts);
elements.listB.addEventListener("input", updateCounts);
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
  current = reconcile(elements.listA.value, elements.listB.value, options());
  activeGroup = "exact";
  render();
  elements.results.hidden = false;
  elements.results.scrollIntoView({ behavior: "smooth", block: "start" });
}

function render() {
  const groups = [
    ["exact", "Exact", current.exact.length], ["normalized", "Normalized", current.normalized.length],
    ["possible", "Possible", current.possible.length], ["onlyA", "Only in A", current.onlyA.length], ["onlyB", "Only in B", current.onlyB.length]
  ];
  elements.summary.replaceChildren(...groups.map(([key, label, count]) => card(label, count, key)));
  elements.tabs.replaceChildren(...groups.map(([key, label, count]) => tab(label, count, key)));
  const items = current[activeGroup];
  elements.rows.replaceChildren(...items.map(row));
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
  button.role = "tab";
  button.setAttribute("aria-selected", String(key === activeGroup));
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

async function importFile(event, textarea) {
  const [file] = event.target.files;
  if (!file) return;
  textarea.value = await file.text();
  updateCounts();
  event.target.value = "";
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
  elements.listA.value = "";
  elements.listB.value = "";
  current = null;
  elements.results.hidden = true;
  updateCounts();
  elements.listA.focus();
}

function loadExample() {
  elements.listA.value = "Acme Corporation\njohn@example.com\nBetter-Proxies\nNorthwind Traders\nNorthwind Traders";
  elements.listB.value = "Acme Corporation\nJohn@example.com\nBetter Proxies\nNorthwind Trading";
  $("#ignore-punctuation").checked = true;
  updateCounts();
}

function updateCounts() {
  elements.countA.textContent = `${parseList(elements.listA.value).length} non-empty lines`;
  elements.countB.textContent = `${parseList(elements.listB.value).length} non-empty lines`;
}

updateCounts();
