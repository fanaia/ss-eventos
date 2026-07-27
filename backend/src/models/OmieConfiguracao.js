"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "OmieConfiguracao",
  singular: "omieConfiguracao",
  basePath: "/integracoes/omie/configuracoes",
  schema: {
    nome: fields.string({ required: true, label: "Nome", default: "Omie SS Eventos" }),
    ativo: fields.boolean({ label: "Ativo", default: true }),
    ambiente: fields.enum(["Homologação", "Produção"], { label: "Ambiente", default: "Produção" }),
    contaCorrenteId: { type: Number, min: 0, __meta: { kind: "number", label: "Conta corrente Omie" } },
    credenciaisConfiguradas: {
      type: Boolean,
      default: false,
      __meta: { kind: "boolean", label: "Credenciais configuradas", readonly: true, readOnly: true },
    },
    statusConexao: fields.enum(["Não testado", "OK", "Erro"], { label: "Status da conexão", default: "Não testado" }),
    ultimoErroConexao: fields.string({ label: "Último erro da conexão", searchable: true }),
    ultimaSincronizacaoCadastrosEm: fields.date({ label: "Última sincronização de cadastros" }),
    ultimaReconciliacaoFinanceiraEm: fields.date({ label: "Última reconciliação financeira" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);

async function desativarOutras(id) {
  await Model.updateMany({ _id: { $ne: id }, ativo: true }, { $set: { ativo: false } });
}

Model.create = async function createConfiguracao(dados = {}, opcoes) {
  const payload = {
    ...dados,
    credenciaisConfiguradas: Boolean(process.env.OMIE_APP_KEY && process.env.OMIE_APP_SECRET),
  };
  const criado = await createOriginal(payload, opcoes);
  if (criado.ativo) await desativarOutras(criado._id);
  return criado;
};

Model.findByIdAndUpdate = async function updateConfiguracao(id, alteracoes = {}, opcoes = {}) {
  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  entrada.credenciaisConfiguradas = Boolean(process.env.OMIE_APP_KEY && process.env.OMIE_APP_SECRET);
  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;
  const atualizado = await updateOriginal(id, payload, { ...opcoes, new: true });
  if (atualizado?.ativo) await desativarOutras(atualizado._id);
  return atualizado;
};

async function obterOuCriarConfiguracaoAtiva() {
  let config = await Model.findOne({ ativo: true }).lean();
  if (config) return config;
  const criada = await Model.create({
    nome: process.env.OMIE_CONFIG_NAME || "Omie SS Eventos",
    ativo: true,
    ambiente: process.env.OMIE_ENVIRONMENT === "homologacao" ? "Homologação" : "Produção",
    contaCorrenteId: Number(process.env.OMIE_CONTA_CORRENTE_ID || 0) || undefined,
  });
  config = criada.toObject ? criada.toObject() : criada;
  return config;
}

module.exports = { obterOuCriarConfiguracaoAtiva };
