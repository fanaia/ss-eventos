"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const {
  consultarContaPagar,
  enviarContaPagar,
  reconciliarFinanceiro,
} = require("./omieIntegration");
const { sanitizarErro } = require("./omieUtils");

function Pagamento() {
  const Model = registry.getModel("Pagamento")?.mongooseModel;
  if (!Model) throw new GenericError("Model Pagamento não registrada.");
  return Model;
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
    const pagamento = await Pagamento().findById(id).lean();
    if (!pagamento) {
      throw new GenericError("Pagamento não encontrado após a integração.", {
        statusCode: 404,
      });
    }
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
  marcarRevisao,
  marcarTrabalhando,
  reconciliarPagamentosAutomaticos,
};
