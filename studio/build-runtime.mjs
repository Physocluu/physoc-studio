import { cp, mkdir, rm } from "node:fs/promises";

const dist = new URL("./dist/", import.meta.url);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const file of ["index.html", "engine.js", "templates-data.js", "announcement-template.js"]) {
  await cp(new URL(`./${file}`, import.meta.url), new URL(`./dist/${file}`, import.meta.url));
}
await cp(new URL("./fonts/", import.meta.url), new URL("./dist/fonts/", import.meta.url), { recursive: true });
console.log("Built Studio runtime with 4 files and self-hosted fonts.");
