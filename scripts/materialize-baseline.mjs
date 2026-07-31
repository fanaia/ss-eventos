import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const output = outputIndex >= 0 && args[outputIndex + 1]
  ? path.resolve(process.cwd(), args[outputIndex + 1])
  : path.join(root, ".baseline-data");
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "baseline/fixtures/ss-eventos-anon.json"), "utf8"),
);

fs.mkdirSync(output, { recursive: true });
for (const [collection, documents] of Object.entries(fixture.collections || {})) {
  fs.writeFileSync(
    path.join(output, `${collection}.json`),
    `${JSON.stringify(documents, null, 2)}\n`,
    "utf8",
  );
}
fs.writeFileSync(
  path.join(output, "manifest.json"),
  `${JSON.stringify({
    dataset: fixture.dataset,
    schemaVersion: fixture.schemaVersion,
    collections: Object.fromEntries(
      Object.entries(fixture.collections || {}).map(([name, documents]) => [name, documents.length]),
    ),
  }, null, 2)}\n`,
  "utf8",
);
console.log(`[baseline] massa materializada em ${output}`);
