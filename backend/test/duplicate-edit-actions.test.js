"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { pathToFileURL } = require("node:url");

const helperUrl = pathToFileURL(
  path.resolve(__dirname, "../../frontend/src/removeDuplicateEditActions.js"),
).href;

async function carregarHelper() {
  return import(helperUrl);
}

test("remove ação textual que abre a mesma aba padrão do ícone de editar", async () => {
  const { removerAcoesEdicaoDuplicadas } = await carregarHelper();
  const manifest = {
    collections: [
      {
        model: "ClienteFornecedor",
        detailModal: { enabled: true, defaultTab: "dados" },
        list: {
          rowActions: [
            { type: "openDetailModal", label: "Editar", initialTab: "dados" },
          ],
        },
      },
    ],
  };

  const result = removerAcoesEdicaoDuplicadas(manifest);

  assert.equal(result.collections[0].list.rowActions, undefined);
});

test("preserva ações diferentes e atalhos para outra aba", async () => {
  const { removerAcoesEdicaoDuplicadas } = await carregarHelper();
  const manifest = {
    collections: [
      {
        model: "Projeto",
        detailModal: { enabled: true, defaultTab: "resumo" },
        list: {
          rowActions: [
            { type: "openDetailModal", label: "Abrir pagamentos", initialTab: "pagamentos" },
            { type: "apiAction", label: "Sincronizar", endpoint: "/sincronizar" },
          ],
        },
      },
    ],
  };

  const result = removerAcoesEdicaoDuplicadas(manifest);

  assert.deepEqual(result.collections[0].list.rowActions, manifest.collections[0].list.rowActions);
});
