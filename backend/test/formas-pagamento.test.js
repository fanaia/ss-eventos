"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");

function caminho(relativo) {
  return path.join(raiz, relativo);
}

function existe(relativo) {
  return fs.existsSync(caminho(relativo));
}

function ler(relativo) {
  return fs.readFileSync(caminho(relativo), "utf8");
}

test("cadastro e campos legados de forma de pagamento foram removidos", () => {
  const pagamento = ler("backend/src/models/Pagamento.js");
  const rota = ler("backend/src/routes/pagamentosItem.js");
  const validacao = ler("backend/src/validations/regrasProjetos.js");

  assert.equal(existe("backend/src/models/FormaPagamento.js"), false);
  assert.doesNotMatch(pagamento, /formaPagamento|formaPagamentoId/);
  assert.doesNotMatch(rota, /FormaPagamento|formaPagamento|formaPagamentoId/);
  assert.doesNotMatch(validacao, /FormaPagamento|formaPagamento|formaPagamentoId/);
});

test("frontend elimina referências de forma de pagamento do manifesto", () => {
  const cleanup = ler("frontend/src/removePaymentMethodFields.js");
  const main = ler("frontend/src/main.tsx");

  assert.equal(existe("frontend/src/paymentMethodsAdjustments.js"), false);
  assert.match(cleanup, /CAMPOS_REMOVIDOS = new Set\(\["formaPagamento", "formaPagamentoId"\]\)/);
  assert.match(cleanup, /collection\.model !== "FormaPagamento"/);
  assert.match(cleanup, /ticketActions: pipeline\.ticketActions\?\.map\(limparAcao\)/);
  assert.match(main, /removerCamposFormaPagamento/);
});

test("pagamento usa Conta Corrente Omie no lugar da forma de pagamento", () => {
  const pagamento = ler("backend/src/models/Pagamento.js");
  const rota = ler("backend/src/routes/pagamentosItem.js");
  const frontend = ler("frontend/src/omieAdjustments.js");

  assert.match(pagamento, /omieContaCorrenteId:\s*fields\.ref\("OmieContaCorrente"/);
  assert.match(rota, /omieContaCorrenteId:\s*req\.body\?\.omieContaCorrenteId \|\| null/);
  assert.match(frontend, /field:\s*"omieContaCorrenteId"/);
  assert.match(frontend, /label:\s*"Conta corrente Omie"/);
  assert.match(frontend, /referenceFilters:/);
});
