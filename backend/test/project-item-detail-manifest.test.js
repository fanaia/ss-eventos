"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const manifesto = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/central.ui.json"), "utf8"),
);
const preparacao = fs.readFileSync(
  path.join(root, "frontend/src/prepareManifest.js"),
  "utf8",
);

const pipeline = manifesto.pipelines.find(
  (item) => item.model === "ProjetoItem" || item.name === "ItensProjeto",
);
const collection = manifesto.collections.find(
  (item) => item.model === "ProjetoItem",
);

test("ticket de ProjetoItem possui as cinco abas reutilizadas pela coleção", () => {
  assert.ok(pipeline, "Esteira de itens não encontrada.");
  assert.ok(collection, "Coleção ProjetoItem não encontrada.");
  assert.deepEqual(
    pipeline.ticketModal.tabs.map((tab) => tab.id),
    ["dados", "orcamento", "fechamento", "totais", "pagamentos"],
  );
});

test("preparação aplica modal, formulário e relações do ticket à coleção", () => {
  assert.match(preparacao, /collection\.model !== "ProjetoItem"/);
  assert.match(preparacao, /form: pipelineItensProjeto\.form \?\? collection\.form/);
  assert.match(preparacao, /\.\.\.\(pipelineItensProjeto\.relations \?\? \{\}\)/);
  assert.match(preparacao, /\.\.\.pipelineItensProjeto\.ticketModal/);
  assert.match(preparacao, /detailModal:/);
});

test("preparação mantém Estados e Cidades fora da navegação", () => {
  assert.match(preparacao, /new Set\(\["Estado", "Cidade"\]\)/);
  assert.match(preparacao, /filter\(\(collection\) => !MODELOS_INTERNOS\.has\(collection\.model\)\)/);
});
