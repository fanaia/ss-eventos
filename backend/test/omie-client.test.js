"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  criarOmieClient,
  OmieApiError,
  normalizarErroResposta,
  sanitizarValor,
} = require("../src/services/omieClient");

test("cliente Omie envia credenciais, mas o diagnóstico não as persiste", async () => {
  let envelopeRecebido;
  const client = criarOmieClient({
    appKey: "key-super-secreta",
    appSecret: "secret-super-secreto",
    maxTentativas: 1,
    fetchImpl: async (_url, opcoes) => {
      envelopeRecebido = JSON.parse(opcoes.body);
      return {
        status: 200,
        text: async () => JSON.stringify({
          pagina: 1,
          total_de_paginas: 1,
          total_de_registros: 1,
          categoria_cadastro: [{ codigo: "1", descricao: "Teste" }],
        }),
      };
    },
  });

  const resposta = await client.chamar("categorias", "ListarCategorias", [{ pagina: 1 }]);
  const traces = client.getTraces();
  const traceSerializado = JSON.stringify(traces);

  assert.equal(envelopeRecebido.app_key, "key-super-secreta");
  assert.equal(envelopeRecebido.app_secret, "secret-super-secreto");
  assert.equal(envelopeRecebido.call, "ListarCategorias");
  assert.equal(resposta.pagina, 1);
  assert.equal(traces.length, 1);
  assert.equal(traces[0].call, "ListarCategorias");
  assert.equal(traces[0].httpStatus, 200);
  assert.equal(traces[0].request.call, "ListarCategorias");
  assert.equal(traces[0].request.param.total, 1);
  assert.equal(traceSerializado.includes("key-super-secreta"), false);
  assert.equal(traceSerializado.includes("secret-super-secreto"), false);
  assert.equal(Object.hasOwn(traces[0].request, "app_key"), false);
  assert.equal(Object.hasOwn(traces[0].request, "app_secret"), false);
});

test("sanitização remove segredos em objetos aninhados", () => {
  const seguro = sanitizarValor({
    app_key: "key",
    appSecret: "secret",
    authorization: "Bearer token",
    dados: {
      password: "senha",
      pagina: 2,
    },
  });

  assert.deepEqual(seguro, { dados: { pagina: 2 } });
});

test("erro funcional em HTTP 200 é tratado como OmieApiError", () => {
  const erro = normalizarErroResposta(
    { faultcode: "SOAP-ENV:Client", faultstring: "Credencial inválida" },
    200,
  );
  assert.ok(erro instanceof OmieApiError);
  assert.equal(erro.retryable, false);
});
