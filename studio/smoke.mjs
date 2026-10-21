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

const browser = await chromium.launch({ ...(process.env.CI ? {} : { channel: "msedge" }), headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
  await page.evaluate(() => document.fonts.ready);
  const templates = await page.evaluate(() => window.PHYSOC_STUDIO.templates.map(({ name, group, html, width, height, w, h }) => ({ name, group, hasPrompt: html.includes('data-label="Carousel prompt"'), w: w || width, h: h || height })));
  if ((await page.locator(".card").count()) !== templates.length) throw new Error("Gallery does not list every template");
  const socials = templates.filter(t => t.group === "Social templates");
  const photoSlides = templates.filter(t => t.group === "Social photo slides");
  const themes = { "Pub Social": ["pub", "rgb(14, 90, 72)"], "Sober Social": ["sober", "rgb(250, 250, 250)"], "Study Session": ["study", "rgb(90, 209, 160)"], "Games Night": ["games", "rgb(191, 243, 106)"] };
  if (socials.length !== 4 || photoSlides.length !== 4 || new Set(templates.map(t => t.name)).size !== templates.length) throw new Error("Social template selection is incomplete or duplicated");

  for (const template of templates) {
    const dimensions = await page.evaluate((name) => {
      window.PHYSOC_STUDIO.openTemplate(name);
      const root = document.querySelector("#export-root");
      const unclear = [...root.querySelectorAll('[data-field]')].filter(el => /title|caption|call to action|introductory text|question|answer/i.test(el.dataset.label) && el.textContent !== el.dataset.label).map(el => el.dataset.label);
      const tag = root.querySelector('.social-tag'), tagCss = tag && getComputedStyle(tag);
      return { width: root.offsetWidth, height: root.offsetHeight, label: root.dataset.screenLabel, problems: window.PHYSOC_STUDIO.preflight(), unclear, tag: tag?.textContent, tagColor: tagCss?.color, tagBackground: tagCss?.backgroundColor, tagBorder: tagCss?.borderWidth };
    }, template.name);
    if (dimensions.width !== template.w || dimensions.height !== template.h || !dimensions.label) throw new Error(`Template failed to load: ${template.name}`);
    if (dimensions.unclear.length) throw new Error(`Template still has sample or vague placeholder copy: ${template.name} ${dimensions.unclear}`);
    if (/^(Pub|Sober) Social/.test(template.name) && dimensions.tag !== 'Social') throw new Error(`Artwork tag must say Social: ${template.name}`);
    if (template.name.startsWith('Games Night') && (dimensions.tagColor !== 'rgb(7, 20, 14)' || dimensions.tagBackground !== 'rgba(0, 0, 0, 0)' || dimensions.tagBorder !== '0px')) throw new Error(`Lime template tag must use plain dark text: ${template.name}`);
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

  // Each category has one fixed graphic and background, with an independent text draft.
  for (const template of socials) {
    await page.evaluate(name => window.PHYSOC_STUDIO.openTemplate(name), template.name);
    const state = await page.evaluate(() => ({ graphic: document.querySelector("#export-root [data-social-graphic]").dataset.socialGraphic, background: getComputedStyle(document.querySelector("#export-root")).backgroundColor, selectors: document.querySelectorAll("#pBody select").length, issues: window.PHYSOC_STUDIO.preflight() }));
    const expected = themes[template.name];
    if (!expected || state.graphic !== expected[0] || state.background !== expected[1] || state.selectors || state.issues.length || template.h !== 1350) throw new Error(`Fixed social theme failed: ${template.name}`);
    if (await page.getByLabel("Event title", { exact: true }).inputValue() !== "Event title" || await page.getByLabel("Caption", { exact: true }).inputValue() !== "Caption") throw new Error("Social copy is not a plain placeholder");
  }
  // The same visibility control covers old swipe bubbles, back prompts and new templates.
  for (const template of templates.filter(t => t.hasPrompt)) {
    await page.evaluate(name => window.PHYSOC_STUDIO.openTemplate(name), template.name);
    const text = page.getByLabel("Carousel prompt", { exact: true });
    const initial = await text.inputValue();
    await text.fill("");
    await page.getByLabel("Show carousel prompt", { exact: true }).uncheck();
    const hidden = await page.evaluate(async () => ({ hidden: !!document.querySelector('#export-root [data-carousel-hidden]'), issues: window.PHYSOC_STUDIO.preflight(), html: await window.PHYSOC_STUDIO.exportHtml() }));
    if (!hidden.hidden || hidden.issues.some(p => p.includes("Carousel prompt")) || hidden.html.includes('data-label="Carousel prompt"')) throw new Error(`Hidden carousel bubble still exports or blocks export: ${template.name}`);
    await page.getByLabel("Show carousel prompt", { exact: true }).check();
    await text.fill(initial);
  }
  // Older drafts have no visibility property and must still recover their prompt text.
  await page.evaluate(() => localStorage.setItem("physoc-studio:draft:social-post", JSON.stringify({ fields: { f7: "Custom photos →" } })));
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Social Post"));
  if (!(await page.getByLabel("Show carousel prompt").isChecked()) || await page.getByLabel("Carousel prompt", { exact: true }).inputValue() !== "Custom photos →") throw new Error("Legacy carousel draft did not recover");
  await page.getByLabel("Show carousel prompt").uncheck();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("physoc-studio:draft:social-post")).carouselVisible?.[0] === false);
  await page.reload();
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Social Post"));
  if (await page.getByLabel("Show carousel prompt").isChecked()) throw new Error("Hidden legacy carousel state did not recover");
  await page.getByLabel("Show carousel prompt").check();
  if (await page.getByLabel("Carousel prompt", { exact: true }).inputValue() !== "Custom photos →") throw new Error("Toggle lost the saved prompt text");
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Pub Social"));
  await page.getByLabel("Show carousel prompt").uncheck();
  await page.locator("#pBody textarea").first().fill("Pub\ncatch-up.");
  const sampleText = '<img src=x onerror="alert(1)">';
  await page.locator('#pBody .fld').filter({ has: page.locator('label', { hasText: /^Venue \/ meeting point$/ }) }).locator('input').fill(sampleText);
  await page.waitForFunction(() => { const draft = JSON.parse(localStorage.getItem("physoc-studio:draft:pub-social") || "{}"); return draft.fields?.title === "Pub\ncatch-up." && draft.carouselVisible?.[0] === false; });
  await page.reload();
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Pub Social"));
  const restored = await page.evaluate(() => ({ title: document.querySelector('#export-root [data-fkey="title"]').textContent, graphic: document.querySelector("#export-root [data-social-graphic]").dataset.socialGraphic, injected: !!document.querySelector('#export-root [data-fkey="location"] img'), venue: document.querySelector('#export-root [data-fkey="location"]').textContent }));
  if (restored.title !== "Pub\ncatch-up." || restored.graphic !== "pub" || restored.injected || restored.venue !== sampleText) throw new Error("Draft recovery or text escaping failed");
  if (await page.getByLabel("Show carousel prompt").isChecked()) throw new Error("New carousel visibility did not recover");
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Sober Social"));
  if (await page.locator('#export-root [data-fkey="title"]').textContent() !== "Event title") throw new Error("Draft leaked into another category");
  await page.locator("#pBody textarea").first().fill("A title that is far too long for the poster. ".repeat(20));
  const overflow = await page.evaluate(() => window.PHYSOC_STUDIO.preflight());
  if (!overflow.some(p => p.includes("Event title") && p.includes("outside"))) throw new Error("Long titles do not trigger the export warning");
  page.once("dialog", dialog => dialog.accept());
  await page.locator("#resetBtn").click();
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);

  for (const template of photoSlides) {
    await page.evaluate(name => window.PHYSOC_STUDIO.openTemplate(name), template.name);
    const coverName = template.name.replace(' Photos (slide 2)', '');
    const background = await page.locator('#export-root').evaluate(el => getComputedStyle(el).backgroundColor);
    if (background !== themes[coverName][1] || await page.locator('#export-root [data-photo]').count() !== 2) throw new Error(`Photo slide does not match its cover: ${template.name}`);
    if (!(await page.evaluate(() => window.PHYSOC_STUDIO.preflight())).includes('2 photo slots are empty.')) throw new Error("Photo slide does not require both images");
    for (let i = 0; i < 2; i++) {
      const chooser = page.waitForEvent('filechooser');
      await page.locator('.photocard button').nth(i).click();
      await (await chooser).setFiles({ name: 'test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="#0F3322"/><circle cx="400" cy="400" r="230" fill="#BFF36A"/></svg>') });
    }
    await page.waitForSelector('#export-root figure:nth-child(2) img.uimg');
    await page.locator('.photocard input[type=range]').first().fill('140');
    await page.getByLabel('Photo 1 caption', { exact: true }).fill('Test caption');
    if ((await page.evaluate(() => window.PHYSOC_STUDIO.preflight())).length) throw new Error(`Filled photo slide fails preflight: ${template.name}`);
    await page.waitForFunction(name => { const key = 'physoc-studio:draft:' + name.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, ''); return JSON.parse(localStorage.getItem(key) || '{}').photos?.[0]?.zoom === 1.4; }, template.name);
    await page.reload();
    await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);
    await page.evaluate(name => window.PHYSOC_STUDIO.openTemplate(name), template.name);
    if (await page.locator('#export-root img.uimg').count() !== 2 || await page.locator('.photocard input[type=range]').first().inputValue() !== '140' || await page.getByLabel('Photo 1 caption', { exact: true }).inputValue() !== 'Test caption') throw new Error("Photo draft did not recover");
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#resetBtn').click();
  }
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => window.PHYSOC_STUDIO?.templates?.length);

  const output = new URL("./output/playwright/", import.meta.url);
  await mkdir(output, { recursive: true });
  const exportNames = ["Social Post", "Social Story", ...socials.map(t => t.name), ...photoSlides.map(t => t.name)];
  const previews = [];
  for (const name of exportNames) {
    const expected = templates.find((template) => template.name === name);
    const html = await page.evaluate((templateName) => { window.PHYSOC_STUDIO.openTemplate(templateName); return window.PHYSOC_STUDIO.exportHtml(); }, name);
    const exportPage = await browser.newPage({ viewport: { width: expected.w, height: expected.h } });
    exportPage.on("console", message => { if (message.type() === "error") console.error(message.text().slice(0, 300)); });
    await exportPage.setContent(html, { waitUntil: "networkidle" });
    await exportPage.evaluate(() => document.fonts?.ready);
    await exportPage.evaluate(() => Promise.all([document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('700 40px "Baloo 2"')]));
    const fontsLoaded = await exportPage.evaluate(() => document.fonts.check('700 40px "Space Grotesk"') && document.fonts.check('700 40px "Baloo 2"') && [...document.fonts].every(f => f.status !== "error"));
    if (!fontsLoaded || !html.includes("data:font/ttf;base64,")) throw new Error(`Export fonts failed: ${name}`);
    const file = new URL(`${name.toLowerCase().replaceAll(" ", "-")}.png`, output);
    const filePath = fileURLToPath(file);
    await exportPage.screenshot({ path: filePath, clip: { x: 0, y: 0, width: expected.w, height: expected.h } });
    await exportPage.close();
    const png = await readFile(filePath);
    if ([...socials, ...photoSlides].some(t => t.name === name)) previews.push({ name, width: expected.w, height: expected.h, png: png.toString("base64") });
    const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
    if (width !== expected.w || height !== expected.h) throw new Error(`Wrong PNG dimensions for ${name}: ${width}x${height}`);
  }
  const board = await browser.newPage({ viewport: { width: 1600, height: 640 } });
  await board.setContent(`<html><style>body{margin:0;padding:32px;background:#eef2ee;color:#07140E;font:18px Arial,sans-serif}h1{margin:0 0 8px;font-size:32px}p{margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(4,360px);gap:28px}figure{margin:0}figcaption{margin:10px 0 0;font-weight:bold;font-size:16px}img{display:block;width:360px;height:auto}</style><h1>PhySoc social templates</h1><p>Four cover/photo pairs. Plain editable placeholders; photo slots await your own images.</p><div class="grid">${previews.map(p => `<figure><img src="data:image/png;base64,${p.png}"><figcaption>${p.name.replace(/^Social /, "")}</figcaption></figure>`).join("")}</div></html>`);
  await board.screenshot({ path: fileURLToPath(new URL("social-template-selection.png", output)), fullPage: true });
  await board.close();
  await page.evaluate(() => window.PHYSOC_STUDIO.openTemplate("Pub Social"));
  let exportRequest;
  await page.route("**/api/export", async route => {
    exportRequest = route.request().postDataJSON();
    await route.fulfill({ contentType: "image/png", body: await readFile(new URL("pub-social.png", output)) });
  });
  const download = page.waitForEvent("download");
  await page.locator("#dlBtn2").click();
  if ((await download).suggestedFilename() !== "pub-social.png" || typeof exportRequest.html !== "string" || !exportRequest.html.includes("data:font/ttf;base64,")) throw new Error("PNG download did not send a complete export document");
  console.log(`Smoke passed for ${templates.length} templates, 4 matching cover/photo pairs, all ${templates.filter(t => t.hasPrompt).length} carousel toggles, legacy/new draft recovery, photo upload/zoom, text overflow, phone keyboard layout, and ${exportNames.length} PNG exports with embedded fonts.`);
} finally {
  await browser.close();
  server.close();
}
