# Testing

Run `npm test` and `npm run check` with Node.js 20 or newer. Tests cover parsing,
normalization, exact-match reservation, duplicate exports, formula cells and comparison
work budgets. No runtime packages or build step are required.

For browser acceptance follow the isolated Playwright instructions in DEVELOPMENT.md
and run `node qa/browser.mjs`. Exercise CSV imports in both panels, cancellation, hostile
text, exports, duplicate groups, option-change invalidation, desktop/mobile layout and
absence of remote requests, cookies or storage. Test the extracted release ZIP too.
