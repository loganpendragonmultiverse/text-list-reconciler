export function parseList(text) {
  if (text.length > 1048576) throw new Error("List text exceeds 1,048,576 characters.");
  return text.split(/\r\n|\r|\n/).map((value, index) => ({ value, line: index + 1 })).filter((item) => item.value.trim());
}

export function normalize(value, options = {}) {
  let result = options.trimSpace === false ? value : value.trim();
  if (options.removeNumbering) result = result.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "");
  if (options.ignoreCase !== false) result = result.toLowerCase();
  if (options.ignorePunctuation) result = result.replace(/[\p{P}\p{S}]/gu, " ");
  if (options.collapseSpace !== false) result = result.replace(/\s+/g, " ");
  if (options.trimSpace !== false) result = result.trim();
  return result;
}

export function reconcile(textA, textB, options = {}) {
  return reconcileItems(parseList(textA), parseList(textB), options);
}

export function reconcileItems(itemsA, itemsB, options = {}) {
  if (itemsA.length > 10000 || itemsB.length > 10000) throw new Error("Compare at most 10,000 items per list.");
  const listA = itemsA.map((item, index) => ({ ...item, index, key: normalize(item.value, options) }));
  const listB = itemsB.map((item, index) => ({ ...item, index, key: normalize(item.value, options) }));
  const duplicatesA = duplicates(listA);
  const duplicatesB = duplicates(listB);
  const usedB = new Set();
  const exact = [];
  const normalized = [];
  const onlyA = [];

  // Reserve all exact pairs before normalization so early variants cannot steal them.
  function queues(field) {
    const groups = new Map();
    for (const item of listB) {
      if (!groups.has(item[field])) groups.set(item[field], []);
      groups.get(item[field]).push(item);
    }
    return groups;
  }
  const exactQueues = queues("value");
  const pendingA = [];
  for (const itemA of listA) {
    const match = exactQueues.get(itemA.value)?.shift();
    if (match) { usedB.add(match.index); exact.push(pair(itemA, match, "Exact", 1)); }
    else pendingA.push(itemA);
  }
  const normalizedQueues = queues("key");
  for (const itemA of pendingA) {
    const candidates = normalizedQueues.get(itemA.key);
    while (candidates?.length && usedB.has(candidates[0].index)) candidates.shift();
    const match = itemA.key ? candidates?.shift() : null;
    if (match) { usedB.add(match.index); normalized.push(pair(itemA, match, "Normalized", 1)); }
    else onlyA.push(itemA);
  }

  const unmatchedB = listB.filter((item) => !usedB.has(item.index));
  const possible = [];
  const matchedNearA = new Set();
  const matchedNearB = new Set();
  if (options.nearMatches !== false) {
    if (onlyA.length * unmatchedB.length > 100000) throw new Error("Too many unmatched pairs for near-match suggestions. Disable near-matches and compare again.");
    let remainingWork = 2000000;
    const candidates = [];
    onlyA.forEach((itemA, indexA) => unmatchedB.forEach((itemB, indexB) => {
      if (!itemA.key || !itemB.key) return;
      const threshold = nearThreshold(itemA.key, itemB.key);
      if (Math.min(itemA.key.length, itemB.key.length) / Math.max(itemA.key.length, itemB.key.length) < threshold) return;
      remainingWork -= itemA.key.length * itemB.key.length;
      if (remainingWork < 0) throw new Error("Near-match work limit reached. Disable near-matches and compare again.");
      const score = similarity(itemA.key, itemB.key);
      if (score >= nearThreshold(itemA.key, itemB.key)) candidates.push({ indexA, indexB, score });
    }));
    candidates.sort((a, b) => b.score - a.score || a.indexA - b.indexA || a.indexB - b.indexB);
    for (const candidate of candidates) {
      if (matchedNearA.has(candidate.indexA) || matchedNearB.has(candidate.indexB)) continue;
      matchedNearA.add(candidate.indexA);
      matchedNearB.add(candidate.indexB);
      possible.push(pair(onlyA[candidate.indexA], unmatchedB[candidate.indexB], "Possible", candidate.score));
    }
  }

  return {
    exact,
    normalized,
    possible,
    onlyA: onlyA.filter((_, index) => !matchedNearA.has(index)).map((item) => pair(item, null, "Only in A", 0)),
    onlyB: unmatchedB.filter((_, index) => !matchedNearB.has(index)).map((item) => pair(null, item, "Only in B", 0)),
    duplicatesA,
    duplicatesB
  };
}

function duplicates(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.key)) groups.set(item.key, []);
    groups.get(item.key).push(item);
  }
  return [...groups.values()].filter((group) => group.length > 1).map((group) => ({ value: group[0].value, lines: group.map((item) => item.line), count: group.length }));
}

function pair(a, b, kind, score) {
  return { a: a?.value ?? "", b: b?.value ?? "", lineA: a?.line ?? null, lineB: b?.line ?? null, kind, score: Math.round(score * 100) / 100 };
}

export function similarity(a, b) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / longer;
}

function nearThreshold(a, b) {
  const length = Math.max(a.length, b.length);
  return length <= 4 ? 0.9 : length <= 10 ? 0.78 : 0.72;
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = old;
    }
  }
  return row[b.length];
}

export function toCsv(result) {
  const rows = [["group", "list_a", "list_b", "line_a", "line_b", "similarity", "occurrence_count"]];
  for (const [group, items] of Object.entries(result)) {
    if (!Array.isArray(items)) continue;
    if (group.startsWith("duplicates")) {
      items.forEach(item => rows.push([group, group === "duplicatesA" ? item.value : "", group === "duplicatesB" ? item.value : "", group === "duplicatesA" ? item.lines.join("; ") : "", group === "duplicatesB" ? item.lines.join("; ") : "", "", item.count]));
      continue;
    }
    items.forEach((item) => rows.push([group, item.a, item.b, item.lineA ?? "", item.lineB ?? "", item.score, ""]));
  }
  return rows.map((row) => row.map(value => csvCell(value, true)).join(",")).join("\r\n") + "\r\n";
}

export function csvCell(value, spreadsheetSafe = false) {
  let text = String(value);
  if (spreadsheetSafe && (/^\s*[=+@-]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return /^\uFEFF|[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
