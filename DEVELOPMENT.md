# Development handoff

The v1 application is dependency-free and local-only. It must not add analytics, remote APIs, or silent fuzzy matching. Any parser expansion needs adversarial tests for quotes, Unicode, large inputs, and formula-like CSV values before export behavior changes.

## Version 1.1 CSV import

Run npm test and npm run check. Regressions cover strict quoting, embedded line breaks, header/column positions, limits, source-preserving cancellation and spreadsheet-like export cells. Browser acceptance must exercise both list panels, keyboard cancellation, safe preview rendering, changed-list guards, counts and no network/storage use. The parser remains dependency-free.

Browser regression: install Playwright only in ignored `.qa` (`npm install --prefix .qa --no-save --package-lock=false playwright@1.55.0`), install its Chromium runtime if needed, then run `node qa/browser.mjs`. The reviewed run used the matching isolated Playwright 1.55.0 container, not a host/browser-profile installation. It checks desktop/mobile layouts, both panels, keyboard selection/Escape, preview escaping, multiline comparisons, download, malformed/oversized import preservation and stale-list refusal. No external requests, storage or cookies were observed. Native assistive-technology acceptance remains unverified.

## 1.2 reconciliation review

Run all unit and browser checks in TESTING.md. Preserve exact-before-normalized priority,
original source whitespace, visible duplicate evidence and bounded synchronous near-matches.
Changing options must hide old results. The production deliverable is the exact tagged site ZIP.
