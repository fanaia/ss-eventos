"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

async function carregarModulo() {
  return import(
    pathToFileURL(
      path.join(raiz, "frontend/src/projectAndDocumentGrid.js"),
    ).href
  );
}

test("formata CPF, CNPJ e preserva documento estrangeiro no DataGrid", async () => {
  const { formatarDocumento, DocumentoMascaradoCell } = await carregarModulo();

  assert.equal(formatarDocumento("30076133885", "PF"), "300.761.338-85");
  assert.equal(formatarDocumento("03349334000163", "PJ"), "03.349.334/0001-63");
  assert.equal(formatarDocumento("60.999.495/0001-36", "PJ"), "60.999.495/0001-36");
  assert.equal(formatarDocumento("US-ABC-123", "Est"), "US-ABC-123");
  assert.equal(
    DocumentoMascaradoCell({ value: "27865757000102", row: { tipo: "PJ" } }),
    "27.865.757/0001-02",
  );
});

test("novo projeto abre em Dados Principais e edição mantém Resumo", async () => {
  const { prepararProjetoEDocumentoGrid } = await carregarModulo();
  const manifest = {
    collections: [
      {
        model: "Projeto",
        list: {
          rowActions: [
            { type: "openDetailModal", initialTab: "resumo" },
          ],
        },
        detailModal: {
          defaultTab: "resumo",
          tabs: [
            { id: "resumo", type: "summary" },
            { id: "dados", type: "form" },
          ],
        },
      },
      {
        model: "ClienteFornecedor",
        list: { columns: ["nome", "tipo", "documento"] },
      },
    ],
  };

  const preparado = prepararProjetoEDocumentoGrid(manifest);
  const projeto = preparado.collections.find((collection) => collection.model === "Projeto");
  const pessoas = preparado.collections.find((collection) => collection.model === "ClienteFornecedor");

  assert.equal(projeto.detailModal.defaultTab, "dados");
  assert.equal(projeto.list.rowActions[0].initialTab, "resumo");
  assert.deepEqual(
    pessoas.list.columns.find((column) => column.field === "documento"),
    {
      field: "documento",
      label: "Documento",
      renderer: "documentoMascarado",
    },
  );
});
