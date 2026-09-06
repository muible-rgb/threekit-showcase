/**
 * Builds the single-file preview of the app.
 *
 * Output is one self-contained HTML file: React, Recharts, the scoring engine,
 * the norms JSON, every screen, and the compiled Tailwind CSS, all inlined. No
 * server, no network, no external assets - which is what lets it be dropped
 * into a page and clicked through.
 *
 *   node demo/build.mjs        ->  demo/dist/longevity-preview.html
 *
 * The app's own source is untouched. next/link and next/navigation are aliased
 * to the shims in demo/shims at bundle time.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const out = join(root, "demo", "dist");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Tailwind. Scans the real source, so the preview gets the real styles.
console.log("building css...");
execFileSync(
  "npx",
  [
    "@tailwindcss/cli",
    "-i",
    join(root, "src", "app", "globals.css"),
    "-o",
    join(out, "app.css"),
    "--minify",
  ],
  { cwd: root, stdio: "inherit" },
);

// 2. Bundle. The CSS import inside app.tsx is stubbed out - Tailwind above
//    already produced the stylesheet, and esbuild would otherwise emit a
//    second, unprocessed copy.
console.log("bundling js...");
await build({
  entryPoints: [join(root, "demo", "app.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2020"],
  jsx: "automatic",
  outfile: join(out, "app.js"),
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": "undefined",
    "process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY": "undefined",
  },
  alias: {
    "next/link": join(root, "demo", "shims", "link.tsx"),
    "next/navigation": join(root, "demo", "shims", "navigation.tsx"),
  },
  loader: { ".css": "empty" },
  logLevel: "warning",
});

// 3. Inline into one file.
const css = readFileSync(join(out, "app.css"), "utf8");
const js = readFileSync(join(out, "app.js"), "utf8");
// Fonts are embedded as base64, not linked. One file, no network, no silent
// fallback to system sans when a request fails. See demo/fetch-fonts.mjs.
const fonts = readFileSync(join(root, "demo", "fonts", "fonts.css"), "utf8");

const html = `<title>The Long Game</title>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<style>
${fonts}
${css}
/* The preview is a phone app on a board-coloured page. */
html, body { background: #141414; color: #f2f0eb; }
#root { min-height: 100dvh; }
</style>
<div id="root"></div>
<script>
${js}
</script>
`;

const file = join(out, "the-long-game-preview.html");
writeFileSync(file, html);

const kb = (n) => `${(n / 1024).toFixed(0)} kB`;
console.log(`\n${file}`);
console.log(`  fonts ${kb(fonts.length)}  css ${kb(css.length)}  js ${kb(js.length)}  total ${kb(html.length)}`);
