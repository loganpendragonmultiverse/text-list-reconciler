# Text List Reconciler

Text List Reconciler compares two arbitrary lists without sending them anywhere. It separates exact matches, normalization-only matches, cautious near-match suggestions, list-specific values, and duplicates so the result can be reviewed instead of guessed.

## Run it

Open `index.html` in a modern browser, or use the hosted GitHub Pages version linked in the repository description. No build step, account, or server is required.

For local development with a stable module origin:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Three-minute workflow

1. Paste one item per line into List A and List B, or import text/CSV files.
2. Select explicit normalization rules.
3. Compare the lists.
4. Review possible matches rather than accepting them silently.
5. Export the complete result as CSV.

Normalization can ignore capitalization, trim or collapse whitespace, ignore punctuation, and remove common list numbering. Near-match suggestions use a conservative edit-distance threshold that becomes stricter for short strings.

## Privacy

Everything runs in the browser tab. There are no analytics, uploads, accounts, cookies, or remote APIs. Imported files are read by the browser and are not transmitted.

## Limitations

- CSV import treats each physical line as an item; it does not select or parse individual CSV columns in v1.0.
- Near matches are suggestions, not accepted merges.
- The application does not save list contents between sessions.
- Very large lists may be slow because cautious near-match comparison examines unmatched pairs.

## Development

Node.js 20 or newer is needed only for tests:

```bash
npm test
npm run check
```

## Project status

**Feature complete for v1.0.** Accessibility, correctness, and import/export improvements are welcome when they preserve local-only operation.

Released under the [MIT License](LICENSE).
