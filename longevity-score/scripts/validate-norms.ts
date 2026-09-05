/** Structural check on every shipped norms file. Run in CI. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateNormsFile } from "../src/lib/norms/schema";

const dir = join(process.cwd(), "data", "norms", "v1");
const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

let errors = 0;
let warnings = 0;

for (const name of files.sort()) {
  const raw = JSON.parse(readFileSync(join(dir, name), "utf8"));
  const issues = validateNormsFile(raw, name);
  const provisional = raw?.source?.provisional ? "provisional" : "sourced";

  if (issues.length === 0) {
    console.log(`  ok      ${name}  (${provisional})`);
    continue;
  }
  console.log(`  ${issues.some((i) => i.level === "error") ? "FAIL   " : "warn   "} ${name}  (${provisional})`);
  for (const i of issues) {
    console.log(`          ${i.level}: ${i.message}`);
    if (i.level === "error") errors++;
    else warnings++;
  }
}

console.log(`\n${files.length} files, ${errors} errors, ${warnings} warnings`);
process.exit(errors > 0 ? 1 : 0);
