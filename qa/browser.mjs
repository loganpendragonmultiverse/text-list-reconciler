import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "../.qa/node_modules/playwright/index.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
await mkdir(path.join(root, ".qa"), { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root)) throw new Error("outside fixture root");
    response.setHeader("Content-Type", file.endsWith(".js") ? "text/javascript" : file.endsWith(".css") ? "text/css" : "text/html");
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [], remote = [];
page.on("pageerror", error => errors.push(error.message));
page.on("request", request => { if (!request.url().startsWith(origin)) remote.push(request.url()); });
const fixture = Buffer.from('name,name,\r\nfirst,"line 1\r\nline 2",x\r\nsecond,"<img src=x onerror=window.__bad=true>",y\r\n');
async function openImport(side = "a", buffer = fixture, name = "data.csv") {
  await page.setInputFiles(`#file-${side}`, { name, mimeType: "text/csv", buffer });
}
async function waitDialog() { await page.locator("#csv-import").waitFor({ state: "visible" }); }
try {
  await page.goto(origin);
  await page.locator("#list-a").fill("original");
  await page.locator("#list-b").fill("comparison");
  await openImport(); await waitDialog();
  await page.locator("#csv-header").check();
  assert.deepEqual(await page.locator("#csv-column option").allTextContents(), ["Column 1: name", "Column 2: name", "Column 3: (unnamed)"]);
  await page.locator("#csv-column").focus();
  await page.keyboard.press("Home"); await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator("#csv-column").inputValue(), "1");
  assert.equal(await page.locator("#csv-preview img").count(), 0);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#list-a").inputValue(), "original");
  assert.equal(await page.locator("#mode-a").inputValue(), "lines");
  await openImport(); await waitDialog();
  await page.locator("#csv-header").check();
  await page.locator("#csv-column").selectOption("1");
  await page.screenshot({ path: path.join(root, ".qa/csv-preview-desktop.png"), fullPage: true });
  await page.locator("#csv-apply").click();
  const imported = await page.locator("#list-a").inputValue();
  assert.equal(await page.locator("#mode-a").inputValue(), "csv");
  assert.match(await page.locator("#count-a").textContent(), /^2 non-empty CSV cells/);
  await page.locator("#mode-b").selectOption("csv");
  await page.locator("#list-b").fill(imported);
  await page.locator("#compare").click();
  assert.match(await page.locator("#summary-grid").textContent(), /2Exact/);
  assert.equal(await page.locator("#result-rows tr").count(), 2);
  assert.equal(await page.locator("#result-rows img").count(), 0);
  assert.equal(await page.evaluate(() => window.__bad), undefined);
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), "list-reconciliation.csv");
  await download.saveAs(path.join(root, ".qa/export.csv"));
  assert.match(await readFile(path.join(root, ".qa/export.csv"), "utf8"), /exact/);
  await openImport("b"); await waitDialog(); await page.locator("#csv-cancel").click();
  assert.equal(await page.locator("#list-b").inputValue(), imported);
  await openImport("a", Buffer.from("a,b\nbad"));
  await page.waitForFunction(() => document.querySelector("#import-status").textContent.includes("column count"));
  assert.equal(await page.locator("#list-a").inputValue(), imported);
  await openImport("a", Buffer.alloc(1048577, 65));
  await page.waitForFunction(() => document.querySelector("#import-status").textContent.includes("1 MiB"));
  assert.equal(await page.locator("#list-a").inputValue(), imported);
  await openImport(); await waitDialog();
  await page.evaluate(() => { document.querySelector("#list-a").value = "new while preview"; });
  await page.locator("#csv-apply").click();
  assert.equal(await page.locator("#list-a").inputValue(), "new while preview");
  assert.match(await page.locator("#import-status").textContent(), /list changed/);
  await page.locator("#reset").click();
  await openImport("a", Buffer.from("a,b\nc,d\n")); await waitDialog();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  await page.screenshot({ path: path.join(root, ".qa/csv-preview-mobile.png"), fullPage: true });
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal((await context.cookies()).length, 0);
  assert.deepEqual(errors, []); assert.deepEqual(remote, []);
  const result = { status: "passed", checks: ["keyboard selection and Escape cancellation", "duplicate and blank header positions", "multiline cell comparison", "safe DOM preview/results", "CSV download", "both list panels", "malformed/oversized source preservation", "changed-list refusal", "mobile width", "no external requests/storage/cookies"], errors, remote };
  await writeFile(path.join(root, ".qa/BROWSER-VERIFICATION.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally { await context.close(); await browser.close(); await new Promise(resolve => server.close(resolve)); }
