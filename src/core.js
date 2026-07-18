export function parseList(text) {
  return text.split(/\r?\n/).map((value, index) => ({ value: value.trimEnd(), line: index + 1 })).filter((item) => item.value.trim());
}

export function normalize(value, options = {}) {
  let result = options.trimSpace === false ? value : value.trim();
  if (options.removeNumbering) result = result.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "");
  if (options.ignoreCase !== false) result = result.toLocaleLowerCase();
  if (options.ignorePunctuation) result = result.replace(/[\p{P}\p{S}]/gu, " ");
  if (options.collapseSpace !== false) result = result.replace(/\s+/g, " ").trim();
  return result;
}

export function reconcile(textA, textB, options = {}) {
  const listA = parseList(textA).map((item, index) => ({ ...item, index, key: normalize(item.value, options) }));
  const listB = parseList(textB).map((item, index) => ({ ...item, index, key: normalize(item.value, options) }));
  const duplicatesA = duplicates(listA);
  const duplicatesB = duplicates(listB);
  const usedB = new Set();
  const exact = [];
  const normalized = [];
  const onlyA = [];

  for (const itemA of listA) {
    let match = listB.find((itemB) => !usedB.has(itemB.index) && itemA.value === itemB.value);
    if (match) {
      usedB.add(match.index);
      exact.push(pair(itemA, match, "Exact", 1));
      continue;
    }
    match = listB.find((itemB) => !usedB.has(itemB.index) && itemA.key && itemA.key === itemB.key);
    if (match) {
      usedB.add(match.index);
      normalized.push(pair(itemA, match, "Normalized", 1));
      continue;
    }
    onlyA.push(itemA);
  }

  const unmatchedB = listB.filter((item) => !usedB.has(item.index));
  const possible = [];
  const matchedNearA = new Set();
  const matchedNearB = new Set();
  if (options.nearMatches !== false) {
    const candidates = [];
    onlyA.forEach((itemA, indexA) => unmatchedB.forEach((itemB, indexB) => {
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
  const rows = [["group", "list_a", "list_b", "line_a", "line_b", "similarity"]];
  for (const [group, items] of Object.entries(result)) {
    if (!Array.isArray(items) || group.startsWith("duplicates")) continue;
    items.forEach((item) => rows.push([group, item.a, item.b, item.lineA ?? "", item.lineB ?? "", item.score]));
  }
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function csvCell(value) {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
