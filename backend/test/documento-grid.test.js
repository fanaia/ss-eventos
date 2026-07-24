"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

async function carregarModulo() {
  return import(
    pathToFileURL(
      path.join(raiz, "frontend/src/documentGrid.js"),
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

test("associa o renderer à coluna Documento sem alterar as demais colunas", async () => {
  const { aplicarMascaraDocumentoNoGrid } = await carregarModulo();
  const manifest = {
    collections: [
      {
        model: "ClienteFornecedor",
        list: { columns: ["nome", "tipo", "documento", "status"] },
      },
      {
        model: "Projeto",
        list: { columns: ["nome", "status"] },
      },
    ],
  };

  const preparado = aplicarMascaraDocumentoNoGrid(manifest);
  const pessoas = preparado.collections.find((collection) => collection.model === "ClienteFornecedor");
  const projetos = preparado.collections.find((collection) => collection.model === "Projeto");

  assert.deepEqual(
    pessoas.list.columns.find((column) => column.field === "documento"),
    {
      field: "documento",
      label: "Documento",
      renderer: "documentoMascarado",
    },
  );
  assert.deepEqual(projetos, manifest.collections[1]);
});

test("registra o renderer no bootstrap atual da Central", () => {
  const main = fs.readFileSync(path.join(raiz, "frontend/src/main.tsx"), "utf8");

  assert.match(main, /aplicarMascaraDocumentoNoGrid\(/);
  assert.match(main, /documentoMascarado:\s*DocumentoMascaradoCell/);
});
