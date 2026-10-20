# Text List Reconciler

Text List Reconciler compares two arbitrary lists without sending them anywhere. It separates exact matches, normalization-only matches, cautious near-match suggestions, list-specific values, and duplicates so the result can be reviewed instead of guessed.

## Run it

Use the hosted GitHub Pages version linked in the repository description, or serve this folder locally with the command below. Browser module restrictions make direct `file:` opening unreliable. No build step or account is required.

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

- CSV import accepts comma-separated UTF-8 records with consistent column counts. Other delimiters and automatic encoding detection are unsupported.
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

**Feature complete for v1.2.** Accessibility, correctness, and import/export improvements are welcome when they preserve local-only operation.

Released under the [MIT License](LICENSE).

## More open-source projects

This project is part of the [Logan Pendragon Forge open-source collection](https://www.loganpendragonforge.com/open-source/). Browse the catalog for other released tools, source repositories, live demos, and downloads.

## CSV import (1.1.0)

Import a `.csv` file to preview a column before replacing a list. Choose the column by
position and explicitly mark whether the first record is a header. Duplicate or blank
header labels remain separate columns. Cancel or Escape leaves the current list unchanged.
Only non-empty selected cells are imported. Quoted commas, escaped quotes and quoted line
breaks are supported; malformed quoting or inconsistent record widths are rejected.

Imported columns use the visible **CSV cells (one column)** input format. Quoted multiline
cells remain one comparison item and can still be edited as single-column CSV. Plain text
keeps the existing one-item-per-line format. Source line numbers refer to the current
editable input, not the original file after column selection/header removal.

Files are limited to 1 MiB; CSV text to 1,048,576 JavaScript characters, 10,000 records,
128 columns and 65,536 characters per field. Large comparisons can still be slow,
especially with near-match suggestions enabled. No content is uploaded or stored.

CSV report exports now prefix spreadsheet formula-like cells with an apostrophe. This
changes only the exported report, not comparison values. Spreadsheet import behavior
varies; inspect unfamiliar exports as text rather than treating CSV as safe executable input.

## Version 1.2: complete reconciliation evidence

Exact pairs are reserved across the complete lists before normalization. Plain-text values
retain their original trailing whitespace; normalization controls affect matching only.
Duplicate groups include occurrence counts and current source lines in the interface and
CSV export. Changing a comparison option hides stale results until you compare again.

Each editable input supports at most 1,048,576 JavaScript characters and 10,000 items. Near-match suggestions stop with an explicit error
above 100,000 unmatched pairs or 2,000,000 edit-distance cells. No partial comparison is
presented; disable near-matches and retry to retain exact, normalized and duplicate reports.
These bounds keep the synchronous local tool suitable for smaller lists; it has no background
worker or automatic fuzzy merges.
