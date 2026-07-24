const { defineModel, fields, registry, GenericError } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "FormaPagamento",
  singular: "formaPagamento",
  basePath: "/formas-pagamento",
  schema: {
    nome: fields.string({ required: true, label: "Nome", searchable: true }),
    padrao: fields.boolean({ label: "Forma padrão", default: false }),
    status: fields.enum(["Ativo", "Inativo"], { label: "Status", default: "Ativo" }),
  },
  crud: {
    enabled: true,
    roles: { write: ["desenvolvedor"] },
  },
});

const Model = entry.mongooseModel;
const createOriginal = Model.create.bind(Model);
const findByIdAndUpdateOriginal = Model.findByIdAndUpdate.bind(Model);
const findByIdAndDeleteOriginal = Model.findByIdAndDelete.bind(Model);
const insertManyOriginal = Model.insertMany.bind(Model);

function erroCampo(field, message) {
  throw new GenericError(message, {
    statusCode: 400,
    details: { field, message },
  });
}

function escaparRegex(valor) {
  return String(valor).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function garantirNomeUnico(nome, ignorarId) {
  const normalizado = String(nome || "").trim();
  if (!normalizado) erroCampo("nome", "Informe o nome da forma de pagamento.");

  const filtro = {
    nome: new RegExp(`^${escaparRegex(normalizado)}$`, "i"),
  };
  if (ignorarId) filtro._id = { $ne: ignorarId };

  const existente = await Model.findOne(filtro).lean();
  if (existente) erroCampo("nome", "Já existe uma forma de pagamento com este nome.");
  return normalizado;
}

async function sincronizarNomeNosPagamentos(formaPagamentoId, nome) {
  const Pagamento = registry.getModel("Pagamento")?.mongooseModel;
  if (!Pagamento) return;
  await Pagamento.updateMany(
    { formaPagamentoId },
    { $set: { formaPagamento: nome } },
  );
}

async function assegurarFormaPadrao(preferidaId) {
  await Model.updateMany(
    { status: { $ne: "Ativo" }, padrao: true },
    { $set: { padrao: false } },
  );

  if (preferidaId) {
    await Model.updateMany(
      { _id: { $ne: preferidaId }, padrao: true },
      { $set: { padrao: false } },
    );
  }

  const padraoAtiva = await Model.findOne({ status: "Ativo", padrao: true }).lean();
  if (padraoAtiva) return padraoAtiva;

  const primeiraAtiva = await Model.findOne({ status: "Ativo" }).sort({ createdAt: 1 }).lean();
  if (!primeiraAtiva) return null;

  await Model.updateOne(
    { _id: primeiraAtiva._id },
    { $set: { padrao: true } },
  );
  return { ...primeiraAtiva, padrao: true };
}

async function prepararCriacao(dados = {}) {
  const preparado = { ...dados };
  preparado.nome = await garantirNomeUnico(preparado.nome);
  preparado.status = preparado.status || "Ativo";
  preparado.padrao = preparado.status === "Ativo" && Boolean(preparado.padrao);
  return preparado;
}

Model.create = async function createComFormaPadrao(dados, opcoes) {
  if (Array.isArray(dados)) {
    const preparados = [];
    let padroes = 0;
    for (const item of dados) {
      const preparado = await prepararCriacao(item);
      if (preparado.padrao) padroes += 1;
      preparados.push(preparado);
    }
    if (padroes > 1) erroCampo("padrao", "Defina somente uma forma de pagamento padrão.");

    const criados = await createOriginal(preparados, opcoes);
    const preferida = criados.find((item) => item.padrao);
    await assegurarFormaPadrao(preferida?._id);
    return criados;
  }

  const preparado = await prepararCriacao(dados);
  const criado = await createOriginal(preparado, opcoes);
  await assegurarFormaPadrao(criado.padrao ? criado._id : undefined);
  return criado;
};

Model.findByIdAndUpdate = async function updateComFormaPadrao(id, alteracoes = {}, opcoes = {}) {
  const atual = await Model.findById(id).lean();
  if (!atual) return null;

  const usaSet = alteracoes && typeof alteracoes === "object" && alteracoes.$set;
  const entrada = usaSet ? { ...alteracoes.$set } : { ...alteracoes };
  const preparado = { ...entrada };

  if (Object.prototype.hasOwnProperty.call(entrada, "nome")) {
    preparado.nome = await garantirNomeUnico(entrada.nome, id);
  }

  const statusFinal = preparado.status ?? atual.status;
  const padraoFinal = Object.prototype.hasOwnProperty.call(preparado, "padrao")
    ? Boolean(preparado.padrao)
    : Boolean(atual.padrao);
  preparado.padrao = statusFinal === "Ativo" && padraoFinal;

  const payload = usaSet
    ? { ...alteracoes, $set: preparado }
    : preparado;
  const atualizado = await findByIdAndUpdateOriginal(id, payload, opcoes);
  if (!atualizado) return atualizado;

  if (Object.prototype.hasOwnProperty.call(preparado, "nome")) {
    await sincronizarNomeNosPagamentos(id, preparado.nome);
  }
  await assegurarFormaPadrao(atualizado.padrao ? atualizado._id : undefined);
  return atualizado;
};

Model.findByIdAndDelete = async function deleteProtegendoUso(id, opcoes = {}) {
  const Pagamento = registry.getModel("Pagamento")?.mongooseModel;
  if (Pagamento && await Pagamento.exists({ formaPagamentoId: id })) {
    throw new GenericError(
      "Esta forma de pagamento está em uso. Inative o cadastro em vez de excluí-lo.",
      { statusCode: 409 },
    );
  }

  const removido = await findByIdAndDeleteOriginal(id, opcoes);
  if (removido?.padrao) await assegurarFormaPadrao();
  return removido;
};

Model.insertMany = async function insertManyComFormaPadrao(registros = [], opcoes = {}) {
  const preparados = [];
  let padroes = 0;
  for (const registro of registros) {
    const preparado = await prepararCriacao(registro);
    if (preparado.padrao) padroes += 1;
    preparados.push(preparado);
  }
  if (padroes > 1) erroCampo("padrao", "Defina somente uma forma de pagamento padrão.");

  const criados = await insertManyOriginal(preparados, opcoes);
  const preferida = criados.find((item) => item.padrao);
  await assegurarFormaPadrao(preferida?._id);
  return criados;
};

module.exports = {
  assegurarFormaPadrao,
};
