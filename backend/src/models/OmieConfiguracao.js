"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");
const {
  criptografarSegredo,
  descriptografarSegredo,
  mascararSegredo,
  gerarTokenWebhook,
} = require("../services/omieSecrets");

const campoSegredo = (label) => ({
  type: String,
  select: false,
  __meta: { kind: "password", label, writeOnly: true },
});

const campoContador = (label) => ({
  type: Number,
  min: 0,
  default: 0,
  __meta: { kind: "number", label, readonly: true, readOnly: true },
});

const entry = defineModel({
  name: "OmieConfiguracao",
  singular: "omieConfiguracao",
  basePath: "/integracoes/omie/configuracoes",
  schema: {
    nome: fields.string({ required: true, label: "Nome", default: "Omie SS Eventos" }),
    ativo: fields.boolean({ label: "Ativo", default: true }),
    ambiente: fields.enum(["Homologação", "Produção"], { label: "Ambiente", default: "Produção" }),
    urlPublica: fields.string({ label: "URL pública da Central" }),
    contaCorrenteId: { type: Number, min: 0, __meta: { kind: "number", label: "Conta corrente Omie" } },
    appKey: campoSegredo("App Key"),
    appSecret: campoSegredo("App Secret"),
    webhookToken: campoSegredo("Token do webhook"),
    appKeyMascarada: fields.string({ label: "App Key configurada" }),
    webhookUrl: fields.string({ label: "URL para configurar no Omie" }),
    credenciaisConfiguradas: {
      type: Boolean,
      default: false,
      __meta: { kind: "boolean", label: "Credenciais configuradas", readonly: true, readOnly: true },
    },
    statusConexao: fields.enum(["Não testado", "OK", "Erro"], { label: "Status da conexão", default: "Não testado" }),
    ultimoErroConexao: fields.string({ label: "Último erro da conexão", searchable: true }),
    ultimaSincronizacaoCadastrosEm: fields.date({ label: "Última sincronização de cadastros" }),
    ultimaSincronizacaoClientesEm: fields.date({ label: "Última sincronização de clientes/prestadores" }),
    ultimaSincronizacaoCategoriasEm: fields.date({ label: "Última sincronização de categorias" }),
    ultimaSincronizacaoFormasPagamentoEm: fields.date({ label: "Última sincronização de meios de pagamento" }),
    ultimaReconciliacaoFinanceiraEm: fields.date({ label: "Última reconciliação financeira" }),
    ultimaAtualizacaoDashboardEm: fields.date({ label: "Indicadores atualizados em" }),
    integracoesPendentes: campoContador("Integrações pendentes"),
    integracoesProcessando: campoContador("Integrações processando"),
    integracoesComErro: campoContador("Integrações com erro"),
    integracoesConcluidas: campoContador("Integrações concluídas"),
    integracoesArquivadas: campoContador("Integrações arquivadas"),
    webhooksPendentes: campoContador("Webhooks pendentes"),
    clientesSincronizados: campoContador("Clientes/prestadores sincronizados"),
    clientesPendentes: campoContador("Clientes/prestadores pendentes"),
    clientesComErro: campoContador("Clientes/prestadores com erro"),
    pagamentosEnviados: campoContador("Pagamentos enviados"),
    pagamentosComErro: campoContador("Pagamentos com erro"),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);

function baseUrlPadrao() {
  return String(process.env.OMIE_PUBLIC_BASE_URL || process.env.PUBLIC_API_URL || "").trim();
}

function normalizarBaseUrl(valor) {
  return String(valor || "").trim().replace(/\/+$/, "");
}

function montarWebhookUrl(baseUrl, token) {
  const base = normalizarBaseUrl(baseUrl);
  return base && token ? `${base}/integracoes/omie/webhooks/${token}` : "";
}

async function desativarOutras(id) {
  await Model.updateMany({ _id: { $ne: id }, ativo: true }, { $set: { ativo: false } });
}

function valorNovo(entrada, campo) {
  const valor = entrada[campo];
  if (valor === undefined || valor === null || String(valor).trim() === "") return undefined;
  return String(valor).trim();
}

function segredoAtual(documento, campo) {
  const valor = documento?.[campo];
  return valor ? descriptografarSegredo(valor) : "";
}

function prepararConfiguracao(entrada = {}, atual = null) {
  const payload = { ...entrada };
  const appKeyNovo = valorNovo(payload, "appKey");
  const appSecretNovo = valorNovo(payload, "appSecret");
  const tokenNovo = valorNovo(payload, "webhookToken");

  if (appKeyNovo) payload.appKey = criptografarSegredo(appKeyNovo);
  else delete payload.appKey;
  if (appSecretNovo) payload.appSecret = criptografarSegredo(appSecretNovo);
  else delete payload.appSecret;
  if (appKeyNovo || appSecretNovo) {
    payload.statusConexao = "Não testado";
    payload.ultimoErroConexao = "";
  }

  const tokenAtual = segredoAtual(atual, "webhookToken");
  const podePersistirSegredos = Boolean(String(process.env.OMIE_CREDENTIALS_ENCRYPTION_KEY || "").trim());
  const token = tokenNovo
    || tokenAtual
    || process.env.OMIE_WEBHOOK_TOKEN
    || (podePersistirSegredos ? gerarTokenWebhook() : "");
  if (token && (tokenNovo || (!atual?.webhookToken && !process.env.OMIE_WEBHOOK_TOKEN))) {
    payload.webhookToken = criptografarSegredo(token);
  } else {
    delete payload.webhookToken;
  }

  const appKey = appKeyNovo || segredoAtual(atual, "appKey") || process.env.OMIE_APP_KEY || "";
  const appSecret = appSecretNovo || segredoAtual(atual, "appSecret") || process.env.OMIE_APP_SECRET || "";
  const urlPublica = normalizarBaseUrl(payload.urlPublica ?? atual?.urlPublica ?? baseUrlPadrao());

  payload.urlPublica = urlPublica;
  payload.credenciaisConfiguradas = Boolean(appKey && appSecret);
  payload.appKeyMascarada = mascararSegredo(appKey);
  payload.webhookUrl = montarWebhookUrl(urlPublica, token);
  return payload;
}

Model.create = async function createConfiguracao(dados = {}, opcoes) {
  const payload = prepararConfiguracao({
    nome: process.env.OMIE_CONFIG_NAME || "Omie SS Eventos",
    ambiente: process.env.OMIE_ENVIRONMENT === "homologacao" ? "Homologação" : "Produção",
    urlPublica: baseUrlPadrao(),
    contaCorrenteId: Number(process.env.OMIE_CONTA_CORRENTE_ID || 0) || undefined,
    ...dados,
  });
  const criado = await createOriginal(payload, opcoes);
  if (criado.ativo) await desativarOutras(criado._id);
  return Model.findById(criado._id);
};

Model.findByIdAndUpdate = async function updateConfiguracao(id, alteracoes = {}, opcoes = {}) {
  const atual = await Model.findById(id).select("+appKey +appSecret +webhookToken");
  if (!atual) return null;
  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  const preparado = prepararConfiguracao(entrada, atual);
  const payload = usaSet ? { ...alteracoes, $set: preparado } : preparado;
  const atualizado = await updateOriginal(id, payload, { ...opcoes, new: true });
  if (atualizado?.ativo) await desativarOutras(atualizado._id);
  return Model.findById(id);
};

async function obterOuCriarConfiguracaoAtiva(opcoes = {}) {
  const selecionarSegredos = Boolean(opcoes.incluirSegredos);
  let consulta = Model.findOne({ ativo: true });
  if (selecionarSegredos) consulta = consulta.select("+appKey +appSecret +webhookToken");
  let config = await consulta.lean();
  if (config) return config;

  const criada = await Model.create({ ativo: true });
  consulta = Model.findById(criada._id);
  if (selecionarSegredos) consulta = consulta.select("+appKey +appSecret +webhookToken");
  return consulta.lean();
}

async function obterCredenciaisConfiguracao() {
  const config = await obterOuCriarConfiguracaoAtiva({ incluirSegredos: true });
  return {
    config,
    appKey: segredoAtual(config, "appKey") || process.env.OMIE_APP_KEY || "",
    appSecret: segredoAtual(config, "appSecret") || process.env.OMIE_APP_SECRET || "",
  };
}

async function obterTokenWebhookAtivo() {
  const config = await obterOuCriarConfiguracaoAtiva({ incluirSegredos: true });
  return segredoAtual(config, "webhookToken") || process.env.OMIE_WEBHOOK_TOKEN || "";
}

module.exports = {
  obterOuCriarConfiguracaoAtiva,
  obterCredenciaisConfiguracao,
  obterTokenWebhookAtivo,
  montarWebhookUrl,
};
