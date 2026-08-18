import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { extname, join } from "node:path";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(join(homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright")));
}

const { onRequest: authenticate } = await import("./functions/_middleware.js");
const closed = await authenticate({ request: new Request("https://studio.example/"), env: {}, next: () => new Response("open") });
if (closed.status !== 503) throw new Error("Authentication did not fail closed");
const { onRequest: exportPng } = await import("./functions/api/export.js");
const unconfiguredExport = await exportPng({ request: new Request("https://studio.example/api/export", { method: "POST" }), env: {} });
if (unconfiguredExport.status !== 503) throw new Error("Chromium export did not fail closed");

const root = new URL("./dist/", import.meta.url);
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".ttf": "font/ttf" };
const server = createServer(async (request, response) => {
  try {
    const path = new URL(request.url, "http://localhost").pathname === "/" ? "index.html" : new URL(request.url, "http://localhost").pathname.slice(1);
    const body = await readFile(new URL(path, root));
    response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
  const templates = await page.evaluate(() => window.PHYSOC_STUDIO.templates.map(({ name, width, height, w, h }) => ({ name, w: w || width, h: h || height })));
  if ((await page.locator(".card").count()) !== templates.length) throw new Error("Gallery does not list every template");

  for (const template of templates) {
    const dimensions = await page.evaluate((name) => {
      window.PHYSOC_STUDIO.openTemplate(name);
      const root = document.querySelector("#export-root");
      return { width: root.offsetWidth, height: root.offsetHeight, label: root.dataset.screenLabel, problems: window.PHYSOC_STUDIO.preflight() };
    }, template.name);
    if (dimensions.width !== template.w || dimensions.height !== template.h || !dimensions.label) throw new Error(`Template failed to load: ${template.name}`);
    if (dimensions.problems.some((problem) => /outside|schedule|safe zone/i.test(problem))) throw new Error(`Default template fails preflight: ${template.name} ${dimensions.problems.join(" ")}`);
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
  await page.keyboard.press("Tab");
  if (!(await page.locator(":focus").evaluate((element) => element.classList.contains("card")))) throw new Error("Template cards are not keyboard reachable");
  await page.keyboard.press("Enter");
  const phone = await page.evaluate(() => ({
    direction: getComputedStyle(document.querySelector("#editor")).flexDirection,
    panelWidth: Math.round(document.querySelector(".panel").getBoundingClientRect().width),
  }));
  if (phone.direction !== "column" || phone.panelWidth !== 390) throw new Error("Phone editor is not stacked");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 1440, height: 1000 });

  const output = new URL("./output/playwright/", import.meta.url);
  await mkdir(output, { recursive: true });
  for (const name of ["Social Post", "Social Story"]) {
    const expected = templates.find((template) => template.name === name);
    const html = await page.evaluate((templateName) => { window.PHYSOC_STUDIO.openTemplate(templateName); return window.PHYSOC_STUDIO.exportHtml(); }, name);
    const exportPage = await browser.newPage({ viewport: { width: expected.w, height: expected.h } });
    await exportPage.setContent(html, { waitUntil: "networkidle" });
    await exportPage.evaluate(() => document.fonts?.ready);
    const file = new URL(`${name.toLowerCase().replaceAll(" ", "-")}.png`, output);
    const filePath = fileURLToPath(file);
    await exportPage.screenshot({ path: filePath, clip: { x: 0, y: 0, width: expected.w, height: expected.h } });
    await exportPage.close();
    const png = await readFile(filePath);
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    if (width !== expected.w || height !== expected.h) throw new Error(`Wrong PNG dimensions for ${name}: ${width}x${height}`);
  }
  console.log(`Smoke passed for ${templates.length} templates, phone keyboard layout, and 2 PNG exports.`);
} finally {
  await browser.close();
  server.close();
}
