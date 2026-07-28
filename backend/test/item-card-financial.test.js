"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const {
  calcularValoresItem,
  resumirPagamento,
} = require("../src/services/calculosProjeto");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const normalizeSpaces = (value) => String(value).replace(/\s/g, " ");

test("card prioriza Valor Orçado, Valor Contratado e Pagamento", () => {
  const model = read("backend/src/models/ProjetoItem.js");
  const orcado = model.indexOf('orcamentoTotal: moedaCalculada("Valor Orçado")');
  const contratado = model.indexOf('contratacaoTotal: moedaCalculada("Valor Contratado")');
  const pagamento = model.indexOf('pagamentoResumo: textoCalculado("Pagamento"');
  const projeto = model.indexOf('projetoId: fields.ref("Projeto"');

  assert.ok(orcado >= 0);
  assert.ok(contratado > orcado);
  assert.ok(pagamento > contratado);
  assert.ok(projeto > pagamento);
});

test("resumo informa Pago ou o saldo pendente em pt-BR", () => {
  assert.equal(resumirPagamento({ status: "Pago", pendente: 0 }), "Pago");
  assert.equal(
    normalizeSpaces(resumirPagamento({ status: "Parcialmente pago", pendente: 1234.5 })),
    "Pendente: R$ 1.234,50",
  );
});

test("alteração da contratação recalcula o valor pendente do card", () => {
  const item = calcularValoresItem({
    faturamento: "Agência",
    orcamentoQuantidade: 2,
    orcamentoDiarias: 3,
    orcamentoValorUnitario: 100,
    contratacaoQuantidade: 2,
    contratacaoDiarias: 3,
    contratacaoValorUnitario: 80,
    pagamentoTotalPago: 200,
    pagamentoStatus: "Parcialmente pago",
  });

  assert.equal(item.orcamentoTotal, 600);
  assert.equal(item.contratacaoTotal, 480);
  assert.equal(item.pagamentoValorPendente, 280);
  assert.equal(normalizeSpaces(item.pagamentoResumo), "Pendente: R$ 280,00");
});
