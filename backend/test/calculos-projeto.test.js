"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  calcularValoresItem,
} = require("../src/services/calculosProjeto");

test("calcula orçamento, contratação, fechamento e lucro", () => {
  const calculado = calcularValoresItem(
    {
      faturamento: "Agência",
      orcamentoQuantidade: 2,
      orcamentoDiarias: 3,
      orcamentoValorUnitario: 100,
      contratacaoQuantidade: 2,
      contratacaoDiarias: 3,
      contratacaoValorUnitario: 80,
    },
    {
      percentualFee: 10,
      percentualImposto: 5,
    },
  );

  assert.equal(calculado.orcamentoTotal, 600);
  assert.equal(calculado.contratacaoTotal, 480);
  assert.equal(calculado.fechamentoValor, 600);
  assert.equal(calculado.fechamentoFee, 60);
  assert.equal(calculado.fechamentoImposto, 33);
  assert.equal(calculado.fechamentoTotal, 693);
  assert.equal(calculado.fechamentoLucroValor, 180);
  assert.equal(calculado.fechamentoLucroPercentual, 30);
});

test("não calcula fee no faturamento por Agência Interna", () => {
  const calculado = calcularValoresItem(
    {
      faturamento: "Agência Interna",
      orcamentoQuantidade: 1,
      orcamentoDiarias: 1,
      orcamentoValorUnitario: 1000,
      contratacaoQuantidade: 1,
      contratacaoDiarias: 1,
      contratacaoValorUnitario: 900,
    },
    {
      percentualFee: 10,
      percentualImposto: 5,
    },
  );

  assert.equal(calculado.fechamentoFee, 0);
  assert.equal(calculado.fechamentoImposto, 50);
  assert.equal(calculado.fechamentoTotal, 1050);
  assert.equal(calculado.fechamentoLucroValor, 100);
  assert.equal(calculado.fechamentoLucroPercentual, 10);
});

test("remove campos calculados enviados pelo cliente e recalcula pelo servidor", () => {
  const calculado = calcularValoresItem(
    {
      faturamento: "Agência",
      orcamentoQuantidade: 1,
      orcamentoDiarias: 1,
      orcamentoValorUnitario: 100,
      contratacaoQuantidade: 1,
      contratacaoDiarias: 1,
      contratacaoValorUnitario: 70,
      orcamentoTotal: 9999,
      contratacaoTotal: 9999,
      fechamentoTotal: 9999,
      fechamentoLucroValor: 9999,
      orcamentoFee: 9999,
      orcamentoImposto: 9999,
    },
    {
      percentualFee: 10,
      percentualImposto: 0,
    },
  );

  assert.equal(calculado.orcamentoTotal, 100);
  assert.equal(calculado.contratacaoTotal, 70);
  assert.equal(calculado.fechamentoTotal, 110);
  assert.equal(calculado.fechamentoLucroValor, 40);
  assert.equal("orcamentoFee" in calculado, false);
  assert.equal("orcamentoImposto" in calculado, false);
});
