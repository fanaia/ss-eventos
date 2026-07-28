"use strict";

const { defineModel, fields, GenericError } = require("@oondemand/oon-core-back");
const { enfileirarIntegracao } = require("./IntegrationOutbox");
const { codigoClienteIntegracao } = require("../services/omieUtils");

function somenteDigitos(valor) { return String(valor || "").replace(/\D/g, ""); }
function todosIguais(valor) { return /^(\d)\1+$/.test(valor); }
function cpfValido(valor) {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || todosIguais(cpf)) return false;
  const digito = (tamanho) => {
    let soma = 0;
    for (let indice = 0; indice < tamanho; indice += 1) {
      soma += Number(cpf[indice]) * (tamanho + 1 - indice);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}
function cnpjValido(valor) {
  const cnpj = somenteDigitos(valor);
  if (cnpj.length !== 14 || todosIguais(cnpj)) return false;
  const digito = (base, pesos) => {
    const soma = base.reduce(
      (total, item, indice) => total + Number(item) * pesos[indice],
      0,
    );
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const base = cnpj.slice(0, 12).split("");
  const primeiro = digito(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digito(
    [...base, String(primeiro)],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  );
  return primeiro === Number(cnpj[12]) && segundo === Number(cnpj[13]);
}

async function valorDoContexto(contexto, campo) {
  if (contexto?.[campo]) return contexto[campo];
  if (typeof contexto?.getUpdate !== "function") return undefined;
  const atualizacao = contexto.getUpdate() || {};
  const valor = atualizacao[campo] || atualizacao.$set?.[campo];
  if (valor) return valor;
  return (await contexto.model.findOne(contexto.getQuery()).select(campo).lean())?.[campo];
}

const documento = {
  type: String,
  trim: true,
  validate: {
    validator: async function validarDocumento(valor) {
      if (!String(valor || "").trim()) return true;
      const origem = await valorDoContexto(this, "origem");
      if (origem === "Omie") return true;
      const tipo = await valorDoContexto(this, "tipo");
      if (tipo === "PF") return cpfValido(valor);
      if (tipo === "PJ") return cnpjValido(valor);
      return tipo === "Est";
    },
    message: "Documento inválido para o tipo informado.",
  },
  __meta: { kind: "string", label: "Documento", searchable: true },
};

const entry = defineModel({
  name: "ClienteFornecedor",
  singular: "clienteFornecedor",
  basePath: "/clientes-fornecedores",
  schema: {
    cliente: fields.boolean({ label: "Cliente", default: false }),
    fornecedor: fields.boolean({ label: "Fornecedor", default: false }),
    nome: fields.string({ required: true, label: "Nome" }),
    tipo: fields.enum(["PF", "PJ", "Est"], {
      required: true,
      label: "Tipo",
      default: "PJ",
    }),
    documento,
    origem: fields.enum(["Local", "Omie"], { label: "Origem", default: "Local" }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
    codigoClienteOmie: {
      type: Number,
      __meta: {
        kind: "number",
        label: "Código Omie",
        readonly: true,
        readOnly: true,
      },
    },
    codigoClienteIntegracao: fields.string({
      label: "Código de integração Omie",
      searchable: true,
    }),
    omieSincronizadoEm: fields.date({ label: "Sincronizado com Omie em" }),
    omieAtualizadoEm: fields.date({ label: "Atualizado no Omie em" }),
    omieStatusIntegracao: fields.enum(
      ["Pendente", "Sincronizado", "Conflito", "Erro"],
      { label: "Status Omie", default: "Pendente" },
    ),
    omieUltimoErro: fields.string({ label: "Último erro Omie", searchable: true }),
    omieErroArquivado: fields.boolean({ label: "Erro Omie arquivado", default: false }),
    omieErroArquivadoEm: fields.date({ label: "Erro Omie arquivado em" }),
    omieErroArquivadoMotivo: fields.string({ label: "Motivo do arquivamento do erro Omie" }),
    omiePayloadHash: fields.string({ label: "Hash enviado ao Omie" }),
    omieVersaoLocal: {
      type: Number,
      min: 1,
      default: 1,
      __meta: {
        kind: "number",
        label: "Versão local",
        readonly: true,
        readOnly: true,
      },
    },
    omieVersaoLocalSincronizada: {
      type: Number,
      min: 0,
      default: 0,
      __meta: {
        kind: "number",
        label: "Versão sincronizada",
        readonly: true,
        readOnly: true,
      },
    },
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
Model.schema.index({ codigoClienteOmie: 1 }, { unique: true, sparse: true });
Model.schema.index({ codigoClienteIntegracao: 1 }, { unique: true, sparse: true });
const createOriginal = Model.create.bind(Model);
const updateOriginal = Model.findByIdAndUpdate.bind(Model);

function validarCadastroLocal(dados = {}) {
  if (dados.origem === "Omie") return;
  if (!String(dados.documento || "").trim()) {
    throw new GenericError("Informe o documento do cliente/fornecedor.", {
      statusCode: 400,
      details: {
        field: "documento",
        message: "Informe o documento do cliente/fornecedor.",
      },
    });
  }
}

async function agendar(documentoCliente) {
  if (!documentoCliente?._id) return;
  const versao = Number(documentoCliente.omieVersaoLocal || 1);
  await enfileirarIntegracao({
    provider: "omie",
    handler: "OMIE_CLIENTE_ALTERAR",
    tipo: "OMIE_CLIENTE_ALTERAR",
    resource: "clientes-prestadores",
    operation: "update",
    aggregateType: "ClienteFornecedor",
    aggregateId: documentoCliente._id,
    idempotencyKey: `omie:cliente-alterar:${documentoCliente._id}:${versao}`,
    payload: { clienteFornecedorId: String(documentoCliente._id), versao },
  });
}

function preparar(dados = {}) {
  const preparado = {
    ...dados,
    origem: dados.origem || "Local",
    omieVersaoLocal: Number(dados.omieVersaoLocal || 1),
    omieStatusIntegracao: dados.omieStatusIntegracao || "Pendente",
    omieUltimoErro: dados.omieUltimoErro || "",
    omieErroArquivado: false,
    omieErroArquivadoEm: null,
    omieErroArquivadoMotivo: "",
  };
  validarCadastroLocal(preparado);
  return preparado;
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

  // Com um documento isolado, o Mongoose pode interpretar o segundo objeto como
  // outro documento. O array deixa explícito que o segundo argumento são opções.
  const [doc] = await createOriginal([preparar(dados)], mongo);
  if (!doc.codigoClienteIntegracao) {
    doc.codigoClienteIntegracao = codigoClienteIntegracao(doc._id);
    await doc.save({ validateBeforeSave: false });
  }
  if (!skipOmieOutbox) await agendar(doc);
  return doc;
};

Model.findByIdAndUpdate = async function atualizarComIntegracao(
  id,
  alteracoes = {},
  opcoes = {},
) {
  const { skipOmieOutbox = false, ...mongo } = opcoes;
  const atual = await Model.findById(id).lean();
  if (!atual) return null;
  const usaSet = Boolean(alteracoes?.$set);
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  const proximo = { ...atual, ...entrada };
  if (proximo.origem !== "Omie") validarCadastroLocal(proximo);
  if (!skipOmieOutbox) {
    entrada.omieVersaoLocal = Number(atual.omieVersaoLocal || 1) + 1;
    entrada.omieStatusIntegracao = "Pendente";
    entrada.omieUltimoErro = "";
    entrada.omieErroArquivado = false;
    entrada.omieErroArquivadoEm = null;
    entrada.omieErroArquivadoMotivo = "";
    entrada.codigoClienteIntegracao = atual.codigoClienteIntegracao
      || codigoClienteIntegracao(id);
  }
  const payload = usaSet ? { ...alteracoes, $set: entrada } : entrada;
  const doc = await updateOriginal(id, payload, { ...mongo, new: true });
  if (!skipOmieOutbox) await agendar(doc);
  return doc;
};

module.exports = { cpfValido, cnpjValido };
