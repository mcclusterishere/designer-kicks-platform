// Runs every *.e2e.mjs suite sequentially and fails if any suite fails.
import { readdirSync } from "fs";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const suites = readdirSync(here).filter((f) => f.endsWith(".e2e.mjs")).sort();

let failed = 0;
for (const suite of suites) {
  console.log(`\n=== ${suite} ===`);
  const res = spawnSync("node", [path.join(here, suite)], { stdio: "inherit" });
  if (res.status !== 0) failed++;
}

console.log(`\n${suites.length - failed}/${suites.length} suites passed`);
process.exit(failed === 0 ? 0 : 1);
