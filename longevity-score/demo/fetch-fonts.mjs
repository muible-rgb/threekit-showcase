/**
 * Downloads the two families and writes them as a self-contained stylesheet
 * with base64 woff2 inside it.
 *
 * The preview is meant to be one file that works with no network. Linking
 * Google Fonts broke that promise quietly: if the request fails, the whole
 * design falls back to system sans and nothing tells you. Embedding removes
 * the failure mode entirely.
 *
 *   node demo/fetch-fonts.mjs   ->  demo/fonts/fonts.css  (committed)
 */
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "fonts");
const URL_CSS =
  "https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap";

// A modern UA is what makes Google serve woff2 rather than ttf.
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const css = await fetch(URL_CSS, { headers: { "User-Agent": UA } }).then((r) => r.text());

// Keep only the latin subsets - this app has no other alphabet on screen.
const blocks = css.split("/*").filter((b) => b.startsWith(" latin */"));
let out = "";
let bytes = 0;

for (const block of blocks) {
  const match = block.match(/url\((https:\/\/[^)]+\.woff2)\)/);
  if (!match) continue;
  const buf = Buffer.from(await fetch(match[1]).then((r) => r.arrayBuffer()));
  bytes += buf.length;
  out += `@font-face{${block
    .slice(" latin */".length)
    .replace(/src:[^;]+;/, `src:url(data:font/woff2;base64,${buf.toString("base64")}) format('woff2');`)
    .replace(/^\s*@font-face\s*\{/, "")
    .replace(/\}\s*$/, "")}}\n`;
}

writeFileSync(join(OUT, "fonts.css"), out);
console.log(`wrote fonts.css - ${blocks.length} faces, ${(bytes / 1024).toFixed(0)} kB of woff2`);
