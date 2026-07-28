"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  criarOmieClient,
  normalizarCall,
} = require("../src/services/omieClient");

test("normaliza qualquer chamada residual de UpsertCliente para AlterarCliente", () => {
  assert.equal(normalizarCall("clientes", "UpsertCliente"), "AlterarCliente");
  assert.equal(normalizarCall("clientes", "AlterarCliente"), "AlterarCliente");
  assert.equal(normalizarCall("contasPagar", "UpsertContaPagar"), "UpsertContaPagar");
});

test("envia AlterarCliente e registra a mesma operação no diagnóstico", async () => {
  let envelope;
  const fetchImpl = async (_url, opcoes) => {
    envelope = JSON.parse(opcoes.body);
    return {
      status: 200,
      text: async () => JSON.stringify({
        codigo_status: "0",
        descricao_status: "Cliente alterado com sucesso",
        codigo_cliente_omie: 123,
      }),
    };
  };
  const traces = [];
  const client = criarOmieClient({
    appKey: "app-key-teste",
    appSecret: "app-secret-teste",
    fetchImpl,
    maxTentativas: 1,
    onTrace: (trace) => traces.push(trace),
  });

  await client.chamar("clientes", "UpsertCliente", [{
    codigo_cliente_omie: 123,
    codigo_cliente_integracao: "SS-EVENTOS:123",
    razao_social: "Cliente Teste",
    nome_fantasia: "Cliente Teste",
  }]);

  assert.equal(envelope.call, "AlterarCliente");
  assert.equal(envelope.param[0].codigo_cliente_omie, 123);
  assert.equal(traces[0].call, "AlterarCliente");
  assert.equal(traces[0].request.call, "AlterarCliente");
  assert.equal(JSON.stringify(traces).includes("app-secret-teste"), false);
});
