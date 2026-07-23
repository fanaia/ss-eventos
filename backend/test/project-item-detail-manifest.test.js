"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const root = path.resolve(__dirname, "../..");
const manifesto = JSON.parse(
  fs.readFileSync(path.join(root, "frontend/central.ui.json"), "utf8"),
);

async function preparar() {
  const modulo = await import(
    pathToFileURL(path.join(root, "frontend/src/prepareManifest.js")).href
  );
  return modulo.prepararManifesto(manifesto);
}

test("coleção ProjetoItem reutiliza o modal em abas do ticket", async () => {
  const preparado = await preparar();
  const pipeline = preparado.pipelines.find(
    (item) => item.model === "ProjetoItem" || item.name === "ItensProjeto",
  );
  const collection = preparado.collections.find(
    (item) => item.model === "ProjetoItem",
  );

  assert.ok(pipeline, "Esteira de itens não encontrada.");
  assert.ok(collection, "Coleção ProjetoItem não encontrada.");
  assert.deepEqual(collection.detailModal, pipeline.ticketModal);
  assert.deepEqual(collection.form, pipeline.form);
  assert.deepEqual(collection.relations.pagamentos, pipeline.relations.pagamentos);
  assert.deepEqual(
    collection.detailModal.tabs.map((tab) => tab.id),
    ["dados", "orcamento", "fechamento", "totais", "pagamentos"],
  );
});

test("Estados e Cidades continuam ocultos da navegação", async () => {
  const preparado = await preparar();
  const modelos = preparado.collections.map((item) => item.model);

  assert.equal(modelos.includes("Estado"), false);
  assert.equal(modelos.includes("Cidade"), false);
});
