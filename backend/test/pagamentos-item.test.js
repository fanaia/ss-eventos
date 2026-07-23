"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calcularSaldoFinanceiro,
  validarValorPagamento,
} = require("../src/services/pagamentosItem");

test("calcula o valor pendente descontando pagamentos já gerados", () => {
  const saldo = calcularSaldoFinanceiro(1000, [
    { valor: 250 },
    { valor: 100.55 },
  ]);

  assert.deepEqual(saldo, {
    totalContratado: 1000,
    totalGerado: 350.55,
    valorPendente: 649.45,
  });
});

test("não retorna saldo negativo quando pagamentos atingem o total", () => {
  const saldo = calcularSaldoFinanceiro(500, [{ valor: 600 }]);
  assert.equal(saldo.valorPendente, 0);
});

test("aceita pagamento parcial e arredonda para duas casas", () => {
  const valor = validarValorPagamento(125.555, {
    totalContratado: 500,
    totalGerado: 0,
    valorPendente: 500,
  });
  assert.equal(valor, 125.56);
});

test("rejeita geração sem contratação", () => {
  assert.throws(
    () => validarValorPagamento(10, {
      totalContratado: 0,
      totalGerado: 0,
      valorPendente: 0,
    }),
    /Informe a contratação/,
  );
});

test("rejeita valor zero e valor acima do saldo", () => {
  const saldo = {
    totalContratado: 500,
    totalGerado: 400,
    valorPendente: 100,
  };

  assert.throws(() => validarValorPagamento(0, saldo), /maior que zero/);
  assert.throws(() => validarValorPagamento(100.01, saldo), /excede o saldo pendente/);
});
