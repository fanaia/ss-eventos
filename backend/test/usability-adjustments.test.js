"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

test("novo projeto abre em dados e registros existentes preservam resumo", async () => {
  const modulo = await import(pathToFileURL(path.join(raiz, "frontend/src/usabilityAdjustments.js")).href);
  const manifest = {
    collections: [{
      model: "Projeto",
      list: {
        rowActions: [{ type: "openDetailModal", initialTab: "resumo" }],
      },
      detailModal: {
        defaultTab: "resumo",
        tabs: [
          { id: "resumo", type: "summary" },
          { id: "dados", type: "form" },
        ],
      },
    }],
  };

  const preparado = modulo.aplicarAjustesUsabilidade(manifest);
  const projeto = preparado.collections[0];

  assert.equal(projeto.detailModal.defaultTab, "dados");
  assert.equal(projeto.list.rowActions[0].initialTab, "resumo");
});

test("pagamentos do item ficam somente leitura na colecao e na esteira", async () => {
  const modulo = await import(pathToFileURL(path.join(raiz, "frontend/src/usabilityAdjustments.js")).href);
  const abaPagamentos = {
    id: "pagamentos",
    type: "relatedGrid",
    editable: true,
    editMode: "inline",
    columns: [
      { field: "valor", editable: true, editor: "currency", required: true },
      { field: "responsavelPagamentoId", editable: true, editor: "ref" },
    ],
  };
  const manifest = {
    collections: [{
      model: "ProjetoItem",
      detailModal: { tabs: [abaPagamentos] },
    }],
    pipelines: [{
      name: "ItensProjeto",
      model: "ProjetoItem",
      ticketModal: { tabs: [abaPagamentos] },
    }],
  };

  const preparado = modulo.aplicarAjustesUsabilidade(manifest);
  const abas = [
    preparado.collections[0].detailModal.tabs[0],
    preparado.pipelines[0].ticketModal.tabs[0],
  ];

  for (const aba of abas) {
    assert.equal(aba.type, "readonlyGrid");
    assert.equal(aba.editable, undefined);
    assert.equal(aba.editMode, undefined);
    for (const coluna of aba.columns) {
      assert.equal(coluna.editable, undefined);
      assert.equal(coluna.editor, undefined);
      assert.equal(coluna.required, undefined);
    }
  }
});
