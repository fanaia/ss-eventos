const { defineModel, fields, registry, GenericError } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "Pagamento",
  singular: "pagamento",
  basePath: "/pagamentos",
  schema: {
    projetoId: fields.ref("Projeto", { required: true, label: "Projeto" }),
    projetoItemId: fields.ref("ProjetoItem", { required: true, label: "Item do Projeto" }),
    dataPrevisaoPagamento: fields.date({ required: true, label: "Data previsão pagamento" }),
    formaPagamentoId: fields.ref("FormaPagamento", { label: "Forma de pagamento" }),
    // Mantido para compatibilidade e como descrição histórica nos cards/listas.
    formaPagamento: fields.string({ label: "Forma de pagamento", searchable: true }),
    valor: fields.currency({ required: true, label: "Valor" }),
    responsavelPagamentoId: fields.ref("Responsavel", {
      required: true,
      label: "Responsável Pagamento",
    }),
    nfRecebida: fields.boolean({ label: "NF Recebida", default: false }),
    etapa: fields.enum(
      ["Solicitado", "Aprovado", "Aguardando NF", "Enviado para Omie", "Pagamento Ok"],
      { required: true, label: "Etapa", default: "Solicitado" }
    ),
    statusTrabalho: fields.enum(
      ["Aguardando início", "Trabalhando", "Revisar"],
      { required: true, label: "Status de trabalho", default: "Aguardando início" }
    ),
  },
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
    populateRefs: true,
  },
});

const Model = entry.mongooseModel;
const createOriginal = Model.create.bind(Model);
const findByIdAndUpdateOriginal = Model.findByIdAndUpdate.bind(Model);
const insertManyOriginal = Model.insertMany.bind(Model);

function erroFormaPagamento(message) {
  throw new GenericError(message, {
    statusCode: 400,
    details: { field: "formaPagamentoId", message },
  });
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
        : "Cadastre ou selecione uma forma de pagamento padrão ativa.",
    );
  }
  return forma;
}

async function prepararCriacao(dados = {}) {
  const preparado = { ...dados };
  const forma = await obterFormaPagamentoAtiva(preparado.formaPagamentoId, true);
  preparado.formaPagamentoId = forma._id;
  preparado.formaPagamento = forma.nome;
  return preparado;
}

Model.create = async function createComFormaPagamento(dados, opcoes) {
  if (Array.isArray(dados)) {
    const preparados = [];
    for (const item of dados) preparados.push(await prepararCriacao(item));
    return createOriginal(preparados, opcoes);
  }
  return createOriginal(await prepararCriacao(dados), opcoes);
};

Model.findByIdAndUpdate = async function updateComFormaPagamento(id, alteracoes = {}, opcoes = {}) {
  const usaSet = alteracoes && typeof alteracoes === "object" && alteracoes.$set;
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };

  if (!Object.prototype.hasOwnProperty.call(entrada, "formaPagamentoId")) {
    return findByIdAndUpdateOriginal(id, alteracoes, opcoes);
  }

  const forma = await obterFormaPagamentoAtiva(entrada.formaPagamentoId);
  entrada.formaPagamentoId = forma._id;
  entrada.formaPagamento = forma.nome;

  const payload = usaSet
    ? { ...alteracoes, $set: entrada }
    : entrada;
  return findByIdAndUpdateOriginal(id, payload, opcoes);
};

Model.insertMany = async function insertManyComFormaPagamento(registros = [], opcoes = {}) {
  const preparados = [];
  for (const registro of registros) preparados.push(await prepararCriacao(registro));
  return insertManyOriginal(preparados, opcoes);
};

module.exports = {
  obterFormaPagamentoAtiva,
};
