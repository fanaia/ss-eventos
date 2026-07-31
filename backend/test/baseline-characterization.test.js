"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { calcularValoresItem } = require("../src/services/calculosProjeto");

const root = path.resolve(__dirname, "../..");
const fixture = JSON.parse(
  fs.readFileSync(path.join(root, "baseline/fixtures/ss-eventos-anon.json"), "utf8"),
);
const scenarios = JSON.parse(
  fs.readFileSync(path.join(root, "baseline/scenarios.json"), "utf8"),
);

test("baseline isolado valida inventário, contratos e versões", () => {
  const result = spawnSync(process.execPath, ["scripts/check-baseline.mjs"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /\[baseline\] OK/);
});

test("massa anonimizada reproduz os cálculos financeiros do golden master", () => {
  for (const caso of fixture.financialCases) {
    const calculado = calcularValoresItem(caso.input, caso.project);
    for (const [campo, esperado] of Object.entries(caso.expected)) {
      assert.equal(calculado[campo], esperado, `${caso.id}.${campo}`);
    }
  }
});

test("todos os cenários obrigatórios têm entrada, saída, fontes e testes", () => {
  assert.deepEqual(
    new Set(scenarios.scenarios.map((scenario) => scenario.id)),
    new Set(scenarios.requiredScenarioIds),
  );
  for (const scenario of scenarios.scenarios) {
    assert.ok(scenario.input, scenario.id);
    assert.ok(scenario.expected, scenario.id);
    assert.ok(scenario.tests.length > 0, scenario.id);
    assert.ok(scenario.sources.length > 0, scenario.id);
  }
});

test("diagnóstico de referência não contém segredos", () => {
  const diagnostic = fixture.integration.diagnostics;
  const payload = JSON.stringify({ request: diagnostic.request, response: diagnostic.response }).toLowerCase();
  for (const key of diagnostic.forbiddenKeys) assert.equal(payload.includes(key.toLowerCase()), false, key);
  for (const value of diagnostic.forbiddenValues) assert.equal(payload.includes(value.toLowerCase()), false, value);
});

test("sincronização completa preserva ordem e continuidade parcial", () => {
  assert.deepEqual(
    fixture.integration.fullSync.orderedResources,
    ["categorias", "contas-correntes", "clientes-prestadores"],
  );
  assert.equal(fixture.integration.fullSync.continueAfterResourceError, true);
  assert.equal(fixture.integration.fullSync.partialFailureStatus, 207);
  assert.equal(fixture.integration.fullSync.successStatus, 200);
});

test("webhooks cobrem baixa total, parcial e estorno", () => {
  const observed = new Set(fixture.integration.webhooks.map((event) => event.expected));
  assert.deepEqual(observed, new Set(["total", "partial", "reversal"]));
});
