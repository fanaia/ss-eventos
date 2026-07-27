"use strict";

const { defineModel, fields, registry, GenericError } = require("@oondemand/oon-core-back");
const { enfileirarIntegracao } = require("./IntegrationOutbox");
const { codigoPagamentoIntegracao } = require("../services/omieUtils");

const entry = defineModel({
  name: "Pagamento",
  singular: "pagamento",
  basePath: "/pagamentos",
  schema: {
    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    projetoItemId: fields.ref("ProjetoItem", { required: true, label: "Item do Projeto" }),
    dataPrevisaoPagamento: fields.date({ required: true, label: "Data previsão pagamento" }),
    formaPagamentoId: fields.ref("FormaPagamento", { label: "Forma de pagamento" }),
    formaPagamento: fields.string({ label: "Forma de pagamento", searchable: true }),
    valor: fields.currency({ required: true, label: "Valor" }),
    responsavelPagamentoId: fields.ref("Responsavel", { required: true, label: "Responsável Pagamento" }),
    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),
    etapa: fields.enum(["Solicitado", "Aprovado", "Aguardando NF", "Enviado para Omie", "Pagamento Ok"], { required: true, label: "Etapa", default: "Solicitado" }),
    statusTrabalho: fields.enum(["Aguardando início", "Trabalhando", "Revisar"], { required: true, label: "Status de trabalho", default: "Aguardando início" }),
    codigoLancamentoIntegracao: fields.string({ label: "Código de integração Omie", searchable: true }),
    codigoLancamentoOmie: { type: Number, __meta: { kind: "number", label: "Lançamento Omie", readonly: true, readOnly: true } },
    omieCodigoCategoriaEnviado: fields.string({ label: "Categoria enviada ao Omie" }),
    omieCodigoClienteFornecedorEnviado: { type: Number, __meta: { kind: "number", label: "Fornecedor enviado ao Omie", readonly: true, readOnly: true } },
    omieNumeroDocumentoEnviado: fields.string({ label: "Documento enviado ao Omie" }),
    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),
    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),
    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),
    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),
    omieLiquidado: fields.boolean({ label: "Liquidado no Omie", default: false }),
    omieStatusIntegracao: fields.enum(["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"], { label: "Status integração Omie", default: "Não enviado" }),
    omieUltimoErro: fields.string({ label: "Último erro Omie", searchable: true }),
    omieErroArquivado: fields.boolean({ label: "Erro Omie arquivado", default: false }),
    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),
    omieErroArquivadoMotivo: fields.string({ label: "Motivo do arquivamento do erro Omie" }),
    omieUltimaSincronizacaoEm: fields.date({ label: "Última sincronização Omie" }),
    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),
    canceladoNaCentral: fields.boolean({ label: "Cancelado na Central", default: false }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] }, populateRefs: true },
});

const Model = entry.mongooseModel;
Model.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });
Model.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });
const createOriginal = Model.create.bind(Model);
const findByIdAndUpdateOriginal = Model.findByIdAndUpdate.bind(Model);
const insertManyOriginal = Model.insertMany.bind(Model);

function erroFormaPagamento(message) {
  throw new GenericError(message, { statusCode: 400, details: { field: "formaPagamentoId", message } });
}

async function obterFormaPagamentoAtiva(formaPagamentoId, usarPadrao = false) {
  const FormaPagamento = registry.getModel("FormaPagamento")?.mongooseModel;
  if (!FormaPagamento) throw new GenericError("Model FormaPagamento não registrada.");
  const forma = formaPagamentoId
    ? await FormaPagamento.findOne({ _id: formaPagamentoId, status: "Ativo" }).lean()
    : usarPadrao
      ? await FormaPagamento.findOne({ padrao: true, status: "Ativo" }).lean()
      : null;
  if (!forma) {
    erroFormaPagamento(
      formaPagamentoId
        ? "Selecione uma forma de pagamento ativa."
        : "Cadastre ou sincronize uma forma de pagamento padrão ativa.",
    );
  }
  return forma;
}

async function prepararCriacao(dados = {}) {
  const preparado = { ...dados };
  const forma = await obterFormaPagamentoAtiva(preparado.formaPagamentoId, true);
  preparado.formaPagamentoId = forma._id;
  preparado.formaPagamento = forma.nome;
  preparado.codigoLancamentoIntegracao = preparado.codigoLancamentoIntegracao
    || (preparado._id ? codigoPagamentoIntegracao(preparado._id) : undefined);
  preparado.omieValorTitulo = Number(preparado.valor || 0);
  preparado.omieValorPago = 0;
  preparado.omieValorPendente = Number(preparado.valor || 0);
  preparado.omieErroArquivado = false;
  preparado.omieErroArquivadoEm = null;
  preparado.omieErroArquivadoMotivo = "";
  return preparado;
}

async function agendarContaPagar(pagamento) {
  if (!pagamento?._id || pagamento.etapa !== "Aprovado" || pagamento.codigoLancamentoOmie) return;
  const codigo = pagamento.codigoLancamentoIntegracao || codigoPagamentoIntegracao(pagamento._id);
  if (!pagamento.codigoLancamentoIntegracao) {
    await Model.updateOne(
      { _id: pagamento._id },
      {
        $set: {
          codigoLancamentoIntegracao: codigo,
          omieStatusIntegracao: "Pendente",
          omieUltimoErro: "",
          omieErroArquivado: false,
          omieErroArquivadoEm: null,
          omieErroArquivadoMotivo: "",
        },
      },
    );
  }
  await enfileirarIntegracao({
    tipo: "OMIE_CONTA_PAGAR_UPSERT",
    aggregateType: "Pagamento",
    aggregateId: pagamento._id,
    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,
    payload: { pagamentoId: String(pagamento._id) },
  });
}

Model.create = async function criarPagamento(dados, opcoes = {}) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  if (Array.isArray(dados)) {
    const preparados = [];
    for (const item of dados) preparados.push(await prepararCriacao(item));
    const criados = await createOriginal(preparados, mongoOptions);
    if (!skipOmieOutbox) for (const criado of criados) await agendarContaPagar(criado);
    return criados;
  }
  const criado = await createOriginal(await prepararCriacao(dados), mongoOptions);
  if (!skipOmieOutbox) await agendarContaPagar(criado);
  return criado;
};

Model.findByIdAndUpdate = async function atualizarPagamento(id, alteracoes = {}, opcoes = {}) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  const atual = await Model.findById(id).lean();
  if (!atual) return null;
  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {
    const protegidos = ["valor", "projetoId", "projetoItemId", "formaPagamentoId"];
    const alterado = protegidos.find(
      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)
        && String(entrada[campo]) !== String(atual[campo]),
    );
    if (alterado) {
      throw new GenericError(
        "O título já foi enviado ao Omie. Cancele/estorne antes de alterar dados financeiros.",
        { statusCode: 409 },
      );
    }
  }
  if (Object.prototype.hasOwnProperty.call(entrada, "formaPagamentoId")) {
    const forma = await obterFormaPagamentoAtiva(entrada.formaPagamentoId);
    entrada.formaPagamentoId = forma._id;
    entrada.formaPagamento = forma.nome;
  }
  if (!atual.codigoLancamentoIntegracao) entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);
  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {
    entrada.omieValorTitulo = Number(entrada.valor || 0);
    entrada.omieValorPendente = Number(entrada.valor || 0);
  }
  if (entrada.etapa === "Aprovado") {
    entrada.omieStatusIntegracao = "Pendente";
    entrada.omieUltimoErro = "";
    entrada.omieErroArquivado = false;
    entrada.omieErroArquivadoEm = null;
    entrada.omieErroArquivadoMotivo = "";
  }
  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;
  const atualizado = await findByIdAndUpdateOriginal(id, payload, { ...mongoOptions, new: true });
  if (!skipOmieOutbox) await agendarContaPagar(atualizado);
  return atualizado;
};

Model.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  const preparados = [];
  for (const registro of registros) preparados.push(await prepararCriacao(registro));
  const criados = await insertManyOriginal(preparados, mongoOptions);
  if (!skipOmieOutbox) for (const criado of criados) await agendarContaPagar(criado);
  return criados;
};

module.exports = { obterFormaPagamentoAtiva, agendarContaPagar };
