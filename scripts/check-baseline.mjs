import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const readJson = (relativePath) => JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
const exists = (relativePath) => fs.existsSync(path.join(root, relativePath));

function fail(message) {
  throw new Error(`[baseline] ${message}`);
}

function globRegex(pattern) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", "\u0000")
    .replaceAll("*", "[^/]*")
    .replaceAll("\u0000", ".*");
  return new RegExp(`^${escaped}$`);
}

function walk(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return [];
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [relativePath.replaceAll("\\", "/")];
  const files = [];
  for (const entry of fs.readdirSync(absolutePath, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "coverage"].includes(entry.name)) continue;
    const child = path.join(relativePath, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) files.push(...walk(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

function collectInventory(inventory) {
  const compiled = inventory.rules.map((rule) => ({
    ...rule,
    regexes: rule.patterns.map(globRegex),
  }));
  const files = [...new Set(inventory.scope.flatMap(walk))].sort();
  const classified = [];
  const unclassified = [];

  for (const file of files) {
    const rule = compiled.find((candidate) => candidate.regexes.some((regex) => regex.test(file)));
    if (!rule) unclassified.push(file);
    else classified.push({ file, classification: rule.classification });
  }

  return { files, classified, unclassified };
}

function assertVersions(reference) {
  const rootPackage = readJson("package.json");
  const backendPackage = readJson("backend/package.json");
  const frontendPackage = readJson("frontend/package.json");

  if (rootPackage.version !== reference.versions.application) fail("versão da aplicação divergiu");
  if (rootPackage.devDependencies?.["@oondemand/create-central-oon"] !== reference.versions.createCentralOon) {
    fail("versão do create-central-oon divergiu");
  }
  if (backendPackage.dependencies?.["@oondemand/oon-core-back"] !== reference.versions.oonCoreBack) {
    fail("versão do OonCore backend divergiu");
  }
  if (frontendPackage.dependencies?.["@oondemand/oon-core-front"] !== reference.versions.oonCoreFront) {
    fail("versão do OonCore frontend divergiu");
  }
}

function assertScenarios(scenarios) {
  const ids = scenarios.scenarios.map((scenario) => scenario.id);
  const required = scenarios.requiredScenarioIds;
  if (new Set(ids).size !== ids.length) fail("há IDs de cenário duplicados");
  if (ids.length !== required.length || required.some((id) => !ids.includes(id))) {
    fail("a matriz não cobre todos os cenários obrigatórios");
  }

  for (const scenario of scenarios.scenarios) {
    if (!scenario.input || !scenario.expected) fail(`cenário ${scenario.id} sem entrada/saída determinística`);
    if (!Array.isArray(scenario.tests) || scenario.tests.length === 0) fail(`cenário ${scenario.id} sem teste`);
    if (!Array.isArray(scenario.sources) || scenario.sources.length === 0) fail(`cenário ${scenario.id} sem fonte`);
    for (const file of [...scenario.tests, ...scenario.sources]) {
      if (!exists(file)) fail(`cenário ${scenario.id} referencia arquivo ausente: ${file}`);
    }
  }
}

function assertFixture(fixture) {
  if (fixture.anonymized !== true || fixture.stableIds !== true) fail("fixture não está marcada como anonimizada e estável");
  if (!Array.isArray(fixture.financialCases) || fixture.financialCases.length < 3) fail("massa financeira insuficiente");

  const diagnostics = fixture.integration?.diagnostics;
  const diagnosticPayload = JSON.stringify({ request: diagnostics?.request, response: diagnostics?.response }).toLowerCase();
  for (const forbidden of diagnostics?.forbiddenValues || []) {
    if (diagnosticPayload.includes(String(forbidden).toLowerCase())) fail(`diagnóstico contém valor secreto proibido: ${forbidden}`);
  }
  for (const forbiddenKey of diagnostics?.forbiddenKeys || []) {
    if (diagnosticPayload.includes(String(forbiddenKey).toLowerCase())) {
      fail(`diagnóstico contém chave proibida: ${forbiddenKey}`);
    }
  }
}

function assertDeliveryContract() {
  const deploy = readJson("oon.deploy.json");
  const workflow = fs.readFileSync(path.join(root, ".github/workflows/publish-dev.yml"), "utf8");
  const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
  if (deploy.appCode !== "ss-eventos") fail("appCode de Dev divergiu");
  if (deploy.runtime !== "ooncore-node-react") fail("runtime de Dev divergiu");
  if (deploy.health?.readyPath !== "/api/ativacao/status") fail("readiness de ativação divergiu");
  if (!/branches:\s*\[main\]/.test(workflow)) fail("workflow não está restrito à main");
  if (!/id-token:\s*write/.test(workflow)) fail("workflow sem OIDC");
  if (!/request-dev\.yml@main/.test(workflow)) fail("workflow reutilizável de Dev divergiu");
  if (!/incorporado à branch `main` por pull request/.test(readme)) fail("regra de merge por PR não documentada");
}

export function runBaselineCheck() {
  const reference = readJson("baseline/reference.json");
  const inventory = readJson("baseline/inventory.rules.json");
  const scenarios = readJson("baseline/scenarios.json");
  const fixture = readJson("baseline/fixtures/ss-eventos-anon.json");

  if (reference.goldenMaster.gitSha !== "3f689bed834aab7dd024a8e31d37bf7623efae58") fail("SHA do golden master divergiu");
  if (reference.comparisonTarget.gitSha !== "7c3506b04c61bf0ca9a6c52ae1e64f6b7b079eab") fail("SHA da v2 divergiu");
  for (const entrypoint of Object.values(reference.entrypoints)) {
    if (!exists(entrypoint)) fail(`entrypoint ausente: ${entrypoint}`);
  }
  for (const artifact of reference.removedDiagnosticArtifacts) {
    if (exists(artifact)) fail(`artefato temporário ainda presente: ${artifact}`);
  }

  assertVersions(reference);
  assertScenarios(scenarios);
  assertFixture(fixture);
  assertDeliveryContract();

  const inventoryResult = collectInventory(inventory);
  if (inventoryResult.files.length === 0) fail("inventário vazio");
  if (inventoryResult.unclassified.length > 0) {
    fail(`arquivos sem classificação: ${inventoryResult.unclassified.join(", ")}`);
  }

  const counts = inventoryResult.classified.reduce((acc, item) => {
    acc[item.classification] = (acc[item.classification] || 0) + 1;
    return acc;
  }, {});
  console.log(`[baseline] OK — ${inventoryResult.files.length} arquivos classificados; ${scenarios.scenarios.length} cenários; ${fixture.financialCases.length} casos financeiros.`);
  console.log(`[baseline] inventário: ${JSON.stringify(counts)}`);
  return { reference, inventoryResult, scenarios, fixture };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runBaselineCheck();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
