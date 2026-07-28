"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const {
  consultarContaPagar,
  enviarContaPagar,
  reconciliarFinanceiro,
} = require("./omieIntegration");
const { sanitizarErro } = require("./omieUtils");

const ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";

function Pagamento() {
  const Model = registry.getModel("Pagamento")?.mongooseModel;
  if (!Model) throw new GenericError("Model Pagamento não registrada.");
  return Model;
}

async function obterPagamento(id) {
  const pagamento = await Pagamento().findById(id).lean();
  if (!pagamento) {
    throw new GenericError("Pagamento não encontrado.", { statusCode: 404 });
  }
  return pagamento;
}

async function exigirEtapaEnvio(id) {
  const pagamento = await obterPagamento(id);
  if (pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO) {
    throw new GenericError(
      "O envio ao Omie somente pode ser executado na etapa Enviado para Omie.",
      { statusCode: 409 },
    );
  }
  return pagamento;
}

async function marcarTrabalhando(id) {
  await Pagamento().updateOne(
    { _id: id },
    {
      $set: {
        statusTrabalho: "Trabalhando",
        omieUltimoErro: "",
      },
    },
  );
}

async function marcarRevisao(id, erro) {
  await Pagamento().updateOne(
    { _id: id },
    {
      $set: {
        statusTrabalho: "Revisar",
        omieStatusIntegracao: "Erro",
        omieUltimoErro: sanitizarErro(erro),
      },
    },
  );
}

async function executarAutomatico(id, operacao) {
  await marcarTrabalhando(id);
  try {
    const resultadoIntegracao = await operacao(id);
    await marcarTrabalhando(id);
    const pagamento = await obterPagamento(id);
    return {
      ...pagamento,
      data: pagamento,
      resultadoIntegracao,
    };
  } catch (erro) {
    await marcarRevisao(id, erro);
    throw erro;
  }
}

async function enviarPagamentoAutomatico(id, opcoes = {}) {
  await exigirEtapaEnvio(id);
  return executarAutomatico(id, (pagamentoId) => enviarContaPagar(pagamentoId, opcoes));
}

async function conciliarPagamentoAutomatico(id, opcoes = {}) {
  return executarAutomatico(id, (pagamentoId) => consultarContaPagar(pagamentoId, opcoes));
}

async function reconciliarPagamentosAutomaticos(opcoes = {}) {
  const resultado = await reconciliarFinanceiro(opcoes);
  const idsComErro = (resultado.erros || [])
    .map((item) => item.pagamentoId)
    .filter(Boolean);

  if (idsComErro.length) {
    await Pagamento().updateMany(
      { _id: { $in: idsComErro } },
      { $set: { statusTrabalho: "Revisar" } },
    );
  }

  return resultado;
}

module.exports = {
  conciliarPagamentoAutomatico,
  enviarPagamentoAutomatico,
  exigirEtapaEnvio,
  marcarRevisao,
  marcarTrabalhando,
  reconciliarPagamentosAutomaticos,
};
