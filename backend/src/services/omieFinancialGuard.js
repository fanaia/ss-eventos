"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const { obterOuCriarConfiguracaoAtiva } = require("../models/OmieConfiguracao");
const { enviarContaPagar } = require("./omieIntegration");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

async function obterContaCorrenteSelecionada() {
  const config = await obterOuCriarConfiguracaoAtiva();
  const codigo = Number(config?.contaCorrenteId || 0);
  if (!codigo) {
    throw new GenericError(
      "Selecione uma conta corrente Omie em Integrações > Omie antes de enviar Contas a Pagar.",
      { statusCode: 409 },
    );
  }
  const conta = await model("OmieContaCorrente").findOne({
    codigo,
    status: "Ativo",
    inativa: { $ne: true },
    bloqueada: { $ne: true },
  }).lean();
  if (!conta) {
    throw new GenericError(
      "A conta corrente selecionada não está ativa na lista sincronizada do Omie. Sincronize as contas e selecione outra.",
      { statusCode: 409 },
    );
  }
  return conta;
}

async function enviarContaPagarValidado(id, opcoes = {}) {
  const conta = await obterContaCorrenteSelecionada();
  const resultado = await enviarContaPagar(id, opcoes);
  await model("Pagamento").updateOne(
    { _id: id },
    { $set: { omieContaCorrenteEnviada: Number(conta.codigo) } },
  );
  return resultado;
}

module.exports = { obterContaCorrenteSelecionada, enviarContaPagarValidado };
