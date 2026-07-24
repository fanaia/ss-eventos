"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

function ler(caminho) {
  return fs.readFileSync(path.join(raiz, caminho), "utf8");
}

test("backend cadastra formas de pagamento e preserva uma forma padrão ativa", () => {
  const model = ler("backend/src/models/FormaPagamento.js");

  assert.match(model, /name:\s*"FormaPagamento"/);
  assert.match(model, /basePath:\s*"\/formas-pagamento"/);
  assert.match(model, /padrao:\s*fields\.boolean/);
  assert.match(model, /status:\s*fields\.enum\(\["Ativo",\s*"Inativo"\]/);
  assert.match(model, /assegurarFormaPadrao/);
  assert.match(model, /updateMany\([\s\S]*padrao:\s*false/);
  assert.match(model, /está em uso\. Inative o cadastro/);
});

test("pagamento usa referência configurada e mantém descrição histórica", () => {
  const pagamento = ler("backend/src/models/Pagamento.js");
  const rota = ler("backend/src/routes/pagamentosItem.js");
  const validacao = ler("backend/src/validations/regrasProjetos.js");

  assert.match(pagamento, /formaPagamentoId:\s*fields\.ref\("FormaPagamento"/);
  assert.match(pagamento, /formaPagamento:\s*fields\.string/);
  assert.match(pagamento, /formaPagamento\s*=\s*forma\.nome/);
  assert.match(rota, /findOne\(\{\s*padrao:\s*true,\s*status:\s*"Ativo"\s*\}\)/);
  assert.match(rota, /formaPagamentoId:\s*formaPagamentoPadrao\?\._id/);
  assert.match(rota, /formaPagamentoId:\s*req\.body\?\.formaPagamentoId/);
  assert.match(validacao, /registroAtivo\([\s\S]*"FormaPagamento"[\s\S]*"formaPagamentoId"/);
});

test("frontend adiciona Configurações e usa selector nas entradas de pagamento", async () => {
  const modulo = await import(
    pathToFileURL(path.join(raiz, "frontend/src/paymentMethodsAdjustments.js")).href
  );
  const manifest = {
    collections: [{ model: "Pagamento", list: { filters: [] } }],
    pipelines: [
      {
        model: "ProjetoItem",
        ticketActions: [{
          id: "gerar-pagamento",
          fields: [{ field: "formaPagamento", kind: "string" }],
        }],
      },
      {
        model: "Pagamento",
        filters: [],
        form: [{ field: "formaPagamento" }],
        ticketModal: {
          tabs: [{
            id: "dados",
            type: "form",
            groups: [{ label: "Pagamento", fields: ["formaPagamento", "valor"] }],
          }],
        },
      },
    ],
  };

  const preparado = modulo.aplicarFormasPagamento(manifest);
  const cadastro = preparado.collections.find((item) => item.model === "FormaPagamento");
  assert.equal(cadastro.section, "Configurações");
  assert.deepEqual(cadastro.list.columns, ["nome", "padrao", "status"]);

  const itens = preparado.pipelines.find((item) => item.model === "ProjetoItem");
  const campoAcao = itens.ticketActions[0].fields[0];
  assert.equal(campoAcao.field, "formaPagamentoId");
  assert.equal(campoAcao.kind, "ref");
  assert.equal(campoAcao.ref, "FormaPagamento");
  assert.deepEqual(campoAcao.referenceFilters, { status: "Ativo" });

  const pagamentos = preparado.pipelines.find((item) => item.model === "Pagamento");
  assert.equal(pagamentos.form[0].field, "formaPagamentoId");
  assert.deepEqual(
    pagamentos.ticketModal.tabs[0].groups[0].fields,
    ["formaPagamentoId", "valor"],
  );
  assert.ok(pagamentos.filters.some((filter) => filter.field === "formaPagamentoId"));
});
