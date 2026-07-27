"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");
const { enfileirarIntegracao } = require("./IntegrationOutbox");
const { codigoClienteIntegracao } = require("../services/omieUtils");

function somenteDigitos(valor) { return String(valor || "").replace(/\D/g, ""); }
function todosIguais(valor) { return /^(\d)\1+$/.test(valor); }
function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice += 1) soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
function cnpjValido(valor) {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  const digito = (base, pesos) => {
    const soma = base.reduce((total, item, indice) => total + Number(item) * pesos[indice], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const base = cnpj.slice(0, 12).split("");
  const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito([...base, String(primeiro)], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
}

async function tipoDoContexto(contexto) {
  if (contexto?.tipo) return contexto.tipo;
  if (typeof contexto?.getUpdate !== "function") return undefined;
  const atualizacao = contexto.getUpdate() || {};
  const tipo = atualizacao.tipo || atualizacao.$set?.tipo;
  if (tipo) return tipo;
  return (await contexto.model.findOne(contexto.getQuery()).select("tipo").lean())?.tipo;
}

const documento = {
  type: String,
  required: true,
  trim: true,
  validate: {
    validator: async function validarDocumento(valor) {
      const tipo = await tipoDoContexto(this);
      if (tipo === "PF") return cpfValido(valor);
      if (tipo === "PJ") return cnpjValido(valor);
      return tipo === "Est" && String(valor || "").trim().length > 0;
    },
    message: "Documento inválido para o tipo informado.",
  },
  __meta: { kind: "string", label: "Documento", required: true, searchable: true },
};

const entry = defineModel({
  name: "ClienteFornecedor",
  singular: "clienteFornecedor",
  basePath: "/clientes-fornecedores",
  schema: {
    cliente: fields.boolean({ label: "Cliente", default: false }),
    fornecedor: fields.boolean({ label: "Fornecedor", default: false }),
    nome: fields.string({ required: true, label: "Nome" }),
    tipo: fields.enum(["PF", "PJ", "Est"], { required: true, label: "Tipo", default: "PJ" }),
    documento,
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
    codigoClienteOmie: { type: Number, __meta: { kind: "number", label: "Código Omie", readonly: true, readOnly: true } },
    codigoClienteIntegracao: fields.string({ label: "Código de integração Omie", searchable: true }),
    omieSincronizadoEm: fields.date({ label: "Sincronizado com Omie em" }),
    omieAtualizadoEm: fields.date({ label: "Atualizado no Omie em" }),
    omieStatusIntegracao: fields.enum(["Pendente", "Sincronizado", "Conflito", "Erro"], { label: "Status Omie", default: "Pendente" }),
    omieUltimoErro: fields.string({ label: "Último erro Omie", searchable: true }),
    omieErroArquivado: fields.boolean({ label: "Erro Omie arquivado", default: false }),
    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),
    omieErroArquivadoMotivo: fields.string({ label: "Motivo do arquivamento do erro Omie" }),
    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),
    omieVersaoLocal: { type: Number, min: 1, default: 1, __meta: { kind: "number", label: "Versão local", readonly: true, readOnly: true } },
    omieVersaoLocalSincronizada: { type: Number, min: 0, default: 0, __meta: { kind: "number", label: "Versão sincronizada", readonly: true, readOnly: true } },
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
Model.schema.index({ codigoClienteOmie: 1 }, { unique: true, sparse: true });
Model.schema.index({ codigoClienteIntegracao: 1 }, { unique: true, sparse: true });
const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);

async function agendar(documentoCliente) {
  if (!documentoCliente?._id) return;
  const versao = Number(documentoCliente.omieVersaoLocal || 1);
  await enfileirarIntegracao({
    tipo: "OMIE_CLIENTE_UPSERT",
    aggregateType: "ClienteFornecedor",
    aggregateId: documentoCliente._id,
    idempotencyKey: `omie:cliente:${documentoCliente._id}:${versao}`,
    payload: { clienteFornecedorId: String(documentoCliente._id), versao },
  });
}

function preparar(dados = {}) {
  return {
    ...dados,
    omieVersaoLocal: Number(dados.omieVersaoLocal || 1),
    omieStatusIntegracao: dados.omieStatusIntegracao || "Pendente",
    omieUltimoErro: dados.omieUltimoErro || "",
    omieErroArquivado: false,
    omieErroArquivadoEm: null,
    omieErroArquivadoMotivo: "",
  };
}

Model.create = async function criarComIntegracao(dados, opcoes = {}) {
  const { skipOmieOutbox = false, ...mongo } = opcoes;
  if (Array.isArray(dados)) {
    const documentos = await createOriginal(dados.map(preparar), mongo);
    if (!skipOmieOutbox) {
      for (const doc of documentos) {
        if (!doc.codigoClienteIntegracao) {
          doc.codigoClienteIntegracao = codigoClienteIntegracao(doc._id);
          await doc.save({ validateBeforeSave: false });
        }
        await agendar(doc);
      }
    }
    return documentos;
  }
  const doc = await createOriginal(preparar(dados), mongo);
  if (!doc.codigoClienteIntegracao) {
    doc.codigoClienteIntegracao = codigoClienteIntegracao(doc._id);
    await doc.save({ validateBeforeSave: false });
  }
  if (!skipOmieOutbox) await agendar(doc);
  return doc;
};

Model.findByIdAndUpdate = async function atualizarComIntegracao(id, alteracoes = {}, opcoes = {}) {
  const { skipOmieOutbox = false, ...mongo } = opcoes;
  const atual = await Model.findById(id).lean();
  if (!atual) return null;
  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  if (!skipOmieOutbox) {
    entrada.omieVersaoLocal = Number(atual.omieVersaoLocal || 1) + 1;
    entrada.omieStatusIntegracao = "Pendente";
    entrada.omieUltimoErro = "";
    entrada.omieErroArquivado = false;
    entrada.omieErroArquivadoEm = null;
    entrada.omieErroArquivadoMotivo = "";
    entrada.codigoClienteIntegracao = atual.codigoClienteIntegracao || codigoClienteIntegracao(id);
  }
  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;
  const doc = await updateOriginal(id, payload, { ...mongo, new: true });
  if (!skipOmieOutbox) await agendar(doc);
  return doc;
};

module.exports = { cpfValido, cnpjValido };
