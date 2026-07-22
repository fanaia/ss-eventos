"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const manifesto = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "../../frontend/central.ui.json"), "utf8"),
);

const pipeline = manifesto.pipelines.find(
  (item) => item.model === "ProjetoItem" || item.name === "ItensProjeto",
);

test("ticket de item usa modal declarativo com abas", () => {
  assert.ok(pipeline, "Esteira de itens não encontrada.");
  assert.equal(pipeline.titleField, "nome");
  assert.equal(pipeline.ticketModal.enabled, true);
  assert.equal(pipeline.ticketModal.size, "full");
  assert.deepEqual(
    pipeline.ticketModal.tabs.map((tab) => tab.id),
    ["dados", "orcamento", "fechamento", "totais", "pagamentos"],
  );
});

test("ticket preserva filtros dependentes e relação de pagamentos", () => {
  const cidade = pipeline.form.find((field) => field.field === "cidadeId");
  const subcategoria = pipeline.form.find((field) => field.field === "subcategoriaId");
  const pagamentos = pipeline.ticketModal.tabs.find((tab) => tab.id === "pagamentos");

  assert.deepEqual(cidade.referenceFilterFrom, { estadoId: "estadoId" });
  assert.deepEqual(subcategoria.referenceFilterFrom, { categoriaPaiId: "categoriaId" });
  assert.deepEqual(pipeline.relations.pagamentos, {
    model: "Pagamento",
    foreignKey: "projetoItemId",
    parentKey: "_id",
    label: "Pagamentos",
  });
  assert.equal(pagamentos.editMode, "inline");
  assert.equal(pagamentos.editable, true);
});

test("campos calculados aparecem apenas no resumo", () => {
  const totais = pipeline.ticketModal.tabs.find((tab) => tab.id === "totais");
  const camposEditaveis = pipeline.ticketModal.tabs
    .filter((tab) => tab.type === "form")
    .flatMap((tab) => (tab.groups || []).flatMap((group) => group.fields));

  assert.equal(totais.type, "summary");
  assert.equal(totais.cards.length, 8);
  assert.equal(camposEditaveis.includes("orcamentoTotalComImpostoFee"), false);
  assert.equal(camposEditaveis.includes("fechamentoTotalComImpostoFee"), false);
});
