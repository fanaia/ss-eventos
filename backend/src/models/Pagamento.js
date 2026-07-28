"use strict";

const { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");
const { enfileirarIntegracao } = require("./IntegrationOutbox");
const { codigoPagamentoIntegracao } = require("../services/omieUtils");

const ETAPA_ENVIO_AUTOMATICO = "Enviado para Omie";
const ETAPA_PAGAMENTO_OK = "Pagamento Ok";
const ETAPAS_AUTOMATICAS = new Set([
  ETAPA_ENVIO_AUTOMATICO,
  ETAPA_PAGAMENTO_OK,
]);

function etapaAutomatica(etapa) {
  return ETAPAS_AUTOMATICAS.has(String(etapa || ""));
}

const entry = defineModel({
  name: "Pagamento",
  singular: "pagamento",
  basePath: "/pagamentos",
  schema: {
    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    projetoItemId: fields.ref("ProjetoItem", {
      required: true,
      label: "Item do Projeto",
    }),
    dataPrevisaoPagamento: fields.date({
      required: true,
      label: "Data previsão pagamento",
    }),
    omieContaCorrenteId: fields.ref("OmieContaCorrente", {
      label: "Conta corrente Omie",
    }),
    valor: fields.currency({ required: true, label: "Valor" }),
    responsavelPagamentoId: fields.ref("Responsavel", {
      required: true,
      label: "Responsável Pagamento",
    }),
    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),
    etapa: fields.enum(
      ["Solicitado", "Aprovado", "Aguardando NF", ETAPA_ENVIO_AUTOMATICO, ETAPA_PAGAMENTO_OK],
      { required: true, label: "Etapa", default: "Solicitado" },
    ),
    statusTrabalho: fields.enum(
      ["Aguardando início", "Trabalhando", "Revisar"],
      {
        required: true,
        label: "Status de trabalho",
        default: "Aguardando início",
      },
    ),
    codigoLancamentoIntegracao: fields.string({
      label: "Código de integração Omie",
      searchable: true,
    }),
    codigoLancamentoOmie: {
      type: Number,
      __meta: {
        kind: "number",
        label: "Lançamento Omie",
        readonly: true,
        readOnly: true,
      },
    },
    omieCodigoCategoriaEnviado: fields.string({
      label: "Categoria enviada ao Omie",
    }),
    omieCodigoClienteFornecedorEnviado: {
      type: Number,
      __meta: {
        kind: "number",
        label: "Fornecedor enviado ao Omie",
        readonly: true,
        readOnly: true,
      },
    },
    omieContaCorrenteEnviada: {
      type: Number,
      __meta: {
        kind: "number",
        label: "Conta corrente enviada ao Omie",
        readonly: true,
        readOnly: true,
      },
    },
    omieNumeroDocumentoEnviado: fields.string({
      label: "Documento enviado ao Omie",
    }),
    omieValorTitulo: fields.currency({ label: "Valor do título Omie" }),
    omieValorPago: fields.currency({ label: "Valor pago no Omie" }),
    omieValorPendente: fields.currency({ label: "Valor pendente no Omie" }),
    omieDataUltimaBaixa: fields.date({ label: "Última baixa no Omie" }),
    omieLiquidado: fields.boolean({
      label: "Liquidado no Omie",
      default: false,
    }),
    omieStatusIntegracao: fields.enum(
      ["Não enviado", "Pendente", "Processando", "Enviado", "Erro", "Cancelado"],
      {
        label: "Status integração Omie",
        default: "Não enviado",
      },
    ),
    omieUltimoErro: fields.string({
      label: "Último erro Omie",
      searchable: true,
    }),
    omieErroArquivado: fields.boolean({
      label: "Erro Omie arquivado",
      default: false,
    }),
    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),
    omieErroArquivadoMotivo: fields.string({
      label: "Motivo do arquivamento do erro Omie",
    }),
    omieUltimaSincronizacaoEm: fields.date({
      label: "Última sincronização Omie",
    }),
    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),
    canceladoNaCentral: fields.boolean({
      label: "Cancelado na Central",
      default: false,
    }),
  },
  crud: {
    enabled: true,
    roles: { write: ["admin", "desenvolvedor"] },
    populateRefs: true,
  },
});

const Model = entry.mongooseModel;
Model.schema.index({ codigoLancamentoIntegracao: 1 }, { unique: true, sparse: true });
Model.schema.index({ codigoLancamentoOmie: 1 }, { unique: true, sparse: true });

const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);
const insertManyOriginal = Model.insertMany.bind(Model);

function prepararCriacao(dados = {}) {
  const etapa = dados.etapa || "Solicitado";
  const envioAutomatico = etapa === ETAPA_ENVIO_AUTOMATICO;
  return {
    ...dados,
    etapa,
    statusTrabalho: etapaAutomatica(etapa)
      ? "Trabalhando"
      : dados.statusTrabalho || "Aguardando início",
    codigoLancamentoIntegracao: dados.codigoLancamentoIntegracao
      || (dados._id ? codigoPagamentoIntegracao(dados._id) : undefined),
    omieValorTitulo: Number(dados.valor || 0),
    omieValorPago: 0,
    omieValorPendente: Number(dados.valor || 0),
    omieStatusIntegracao: envioAutomatico
      ? "Pendente"
      : dados.omieStatusIntegracao || "Não enviado",
    omieUltimoErro: envioAutomatico ? "" : dados.omieUltimoErro || "",
    omieErroArquivado: false,
    omieErroArquivadoEm: null,
    omieErroArquivadoMotivo: "",
  };
}

async function agendarContaPagar(pagamento) {
  if (
    !pagamento?._id
    || pagamento.etapa !== ETAPA_ENVIO_AUTOMATICO
    || pagamento.codigoLancamentoOmie
  ) {
    return;
  }

  const codigo = pagamento.codigoLancamentoIntegracao
    || codigoPagamentoIntegracao(pagamento._id);
  await Model.updateOne(
    { _id: pagamento._id },
    {
      $set: {
        codigoLancamentoIntegracao: codigo,
        statusTrabalho: "Trabalhando",
        omieStatusIntegracao: "Pendente",
        omieUltimoErro: "",
        omieErroArquivado: false,
        omieErroArquivadoEm: null,
        omieErroArquivadoMotivo: "",
      },
    },
  );

  await enfileirarIntegracao({
    provider: "omie",
    handler: "OMIE_CONTA_PAGAR_UPSERT",
    tipo: "OMIE_CONTA_PAGAR_UPSERT",
    resource: "contas-pagar",
    operation: "upsert",
    aggregateType: "Pagamento",
    aggregateId: pagamento._id,
    idempotencyKey: `omie:conta-pagar:${pagamento._id}`,
    payload: { pagamentoId: String(pagamento._id) },
  });
}

Model.create = async function criarPagamento(dados, opcoes = {}) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  if (Array.isArray(dados)) {
    const criados = await createOriginal(dados.map(prepararCriacao), mongoOptions);
    if (!skipOmieOutbox) {
      for (const criado of criados) await agendarContaPagar(criado);
    }
    return criados;
  }

  const [criado] = await createOriginal([prepararCriacao(dados)], mongoOptions);
  if (!skipOmieOutbox) await agendarContaPagar(criado);
  return criado;
};

Model.findByIdAndUpdate = async function atualizarPagamento(
  id,
  alteracoes = {},
  opcoes = {},
) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  const atual = await Model.findById(id).lean();
  if (!atual) return null;

  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  const conciliarAgora = entrada._conciliarOmie === true
    || entrada._conciliarOmie === "true";
  delete entrada._conciliarOmie;

  if (conciliarAgora) {
    if (atual.etapa !== ETAPA_ENVIO_AUTOMATICO) {
      throw new GenericError(
        "A conciliação manual somente está disponível em Enviado para Omie.",
        { statusCode: 409 },
      );
    }
    const {
      conciliarPagamentoAutomatico,
    } = require("../services/omiePagamentoAutomatico");
    await conciliarPagamentoAutomatico(id);
    return Model.findById(id);
  }

  if (etapaAutomatica(atual.etapa) && !skipOmieOutbox) {
    throw new GenericError(
      "Esta é uma etapa automática. Os campos e as ações do pagamento ficam bloqueados.",
      { statusCode: 409 },
    );
  }

  if (entrada.etapa === ETAPA_PAGAMENTO_OK && !skipOmieOutbox) {
    throw new GenericError(
      "A etapa Pagamento Ok somente pode ser definida pela conciliação com o Omie.",
      { statusCode: 409 },
    );
  }

  if (
    entrada.etapa === ETAPA_ENVIO_AUTOMATICO
    && atual.etapa !== ETAPA_ENVIO_AUTOMATICO
  ) {
    if (atual.etapa !== "Aguardando NF") {
      throw new GenericError(
        "O pagamento somente pode entrar em Enviado para Omie após Aguardando NF.",
        { statusCode: 409 },
      );
    }
    entrada.statusTrabalho = "Trabalhando";
    entrada.omieStatusIntegracao = "Pendente";
    entrada.omieUltimoErro = "";
    entrada.omieErroArquivado = false;
    entrada.omieErroArquivadoEm = null;
    entrada.omieErroArquivadoMotivo = "";
  }

  if (atual.codigoLancamentoOmie && !skipOmieOutbox) {
    const protegidos = ["valor", "projetoId", "projetoItemId", "omieContaCorrenteId"];
    const alterado = protegidos.find(
      (campo) => Object.prototype.hasOwnProperty.call(entrada, campo)
        && String(entrada[campo]) !== String(atual[campo]),
    );
    if (alterado) {
      throw new GenericError(
        "O título já foi enviado ao Omie. Cancele ou estorne antes de alterar dados financeiros.",
        { statusCode: 409 },
      );
    }
  }

  if (!atual.codigoLancamentoIntegracao) {
    entrada.codigoLancamentoIntegracao = codigoPagamentoIntegracao(id);
  }
  if (Object.prototype.hasOwnProperty.call(entrada, "valor") && !atual.codigoLancamentoOmie) {
    entrada.omieValorTitulo = Number(entrada.valor || 0);
    entrada.omieValorPendente = Number(entrada.valor || 0);
  }

  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;
  const atualizado = await updateOriginal(id, payload, {
    ...mongoOptions,
    new: true,
  });
  if (!skipOmieOutbox) await agendarContaPagar(atualizado);
  return atualizado;
};

Model.insertMany = async function inserirPagamentos(registros = [], opcoes = {}) {
  const { skipOmieOutbox = false, ...mongoOptions } = opcoes;
  const criados = await insertManyOriginal(
    registros.map(prepararCriacao),
    mongoOptions,
  );
  if (!skipOmieOutbox) {
    for (const criado of criados) await agendarContaPagar(criado);
  }
  return criados;
};

module.exports = {
  ETAPA_ENVIO_AUTOMATICO,
  ETAPA_PAGAMENTO_OK,
  ETAPAS_AUTOMATICAS,
  agendarContaPagar,
  etapaAutomatica,
};
