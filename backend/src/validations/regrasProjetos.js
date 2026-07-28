"use strict";

const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");
const {
  dadosConsolidados,
  dadosComDependenciaOpcional,
  subcategoriaPertenceACategoria,
} = require("../services/dadosValidacao");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function erroCampo(field, message) {
  throw new GenericError(message, { details: { field, message } });
}

async function registroAtivo(nome, id, field, mensagem) {
  if (!id) erroCampo(field, mensagem);
  const registro = await model(nome).findById(id).lean();
  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);
  return registro;
}

function porPrioridade(item, categorias) {
  const porId = new Map(categorias.map((categoria) => [String(categoria._id), categoria]));
  return [
    porId.get(String(item.subcategoriaId || "")),
    porId.get(String(item.categoriaId || "")),
  ].filter(Boolean);
}

async function mapeamentoOmieValidoParaItem(item) {
  const categorias = await model("Categoria").find({
    _id: { $in: [item.subcategoriaId, item.categoriaId].filter(Boolean) },
  }).lean();
  const prioridade = porPrioridade(item, categorias);
  const categoriaLocal = prioridade.find((registro) => registro.omieCategoriaId);
  const contaLocal = prioridade.find((registro) => registro.omieContaCorrenteId);
  if (!categoriaLocal || !contaLocal) return null;

  const [categoria, contaCorrente] = await Promise.all([
    model("OmieCategoria").findById(categoriaLocal.omieCategoriaId).lean(),
    model("OmieContaCorrente").findById(contaLocal.omieContaCorrenteId).lean(),
  ]);
  const categoriaValida = categoria
    && categoria.status === "Ativo"
    && !categoria.contaInativa
    && !categoria.totalizadora
    && !categoria.transferencia
    && !categoria.naoExibir;
  const contaValida = contaCorrente
    && contaCorrente.status === "Ativo"
    && !contaCorrente.inativa
    && !contaCorrente.bloqueada;

  return categoriaValida && contaValida
    ? { categoria, contaCorrente }
    : null;
}

defineValidation("Projeto", async (dados, contexto) => {
  const entrada = dadosConsolidados(dados, contexto);
  const cliente = await registroAtivo(
    "ClienteFornecedor",
    entrada.clienteId,
    "clienteId",
    "Selecione um cliente ativo.",
  );
  if (!cliente.cliente) {
    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");
  }

  const fornecedor = await registroAtivo(
    "ClienteFornecedor",
    entrada.fornecedorId,
    "fornecedorId",
    "Selecione um fornecedor ativo.",
  );
  if (!fornecedor.fornecedor) {
    erroCampo(
      "fornecedorId",
      "O cadastro selecionado não está marcado como Fornecedor.",
    );
  }

  const contato = await registroAtivo(
    "Contato",
    entrada.contatoPrincipalId,
    "contatoPrincipalId",
    "Selecione um contato ativo.",
  );
  if (String(contato.clienteFornecedorId) !== String(entrada.clienteId)) {
    erroCampo(
      "contatoPrincipalId",
      "O contato principal deve pertencer ao cliente selecionado.",
    );
  }
});

defineValidation("ProjetoItem", async (dados, contexto) => {
  const entrada = dadosComDependenciaOpcional(
    dados,
    contexto,
    "categoriaId",
    "subcategoriaId",
  );
  await registroAtivo(
    "Projeto",
    entrada.projetoId,
    "projetoId",
    "Selecione um projeto ativo.",
  );
  await registroAtivo(
    "Responsavel",
    entrada.responsavelId,
    "responsavelId",
    "Selecione um responsável ativo.",
  );
  const estado = await registroAtivo(
    "Estado",
    entrada.estadoId,
    "estadoId",
    "Selecione um estado ativo.",
  );
  const cidade = await registroAtivo(
    "Cidade",
    entrada.cidadeId,
    "cidadeId",
    "Selecione uma cidade ativa.",
  );
  if (String(cidade.estadoId) !== String(estado._id)) {
    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");
  }

  const categoria = await registroAtivo(
    "Categoria",
    entrada.categoriaId,
    "categoriaId",
    "Selecione uma categoria ativa.",
  );
  if (categoria.categoriaPaiId) {
    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");
  }
  if (entrada.subcategoriaId) {
    const subcategoria = await registroAtivo(
      "Categoria",
      entrada.subcategoriaId,
      "subcategoriaId",
      "Selecione uma subcategoria ativa.",
    );
    subcategoriaPertenceACategoria(categoria._id, subcategoria);
  }
});

defineValidation("Pagamento", async (dados, contexto) => {
  const entrada = dadosConsolidados(dados, contexto);
  const item = await model("ProjetoItem").findById(entrada.projetoItemId).lean();
  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");
  if (String(item.projetoId) !== String(entrada.projetoId)) {
    erroCampo(
      "projetoItemId",
      "O pagamento deve estar vinculado ao mesmo projeto do item.",
    );
  }

  const responsavel = await registroAtivo(
    "Responsavel",
    entrada.responsavelPagamentoId,
    "responsavelPagamentoId",
    "Selecione um responsável de pagamento ativo.",
  );
  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {
    erroCampo(
      "responsavelPagamentoId",
      "O responsável selecionado não está habilitado para pagamentos.",
    );
  }

  if (entrada.etapa === "Aprovado" && !await mapeamentoOmieValidoParaItem(item)) {
    erroCampo(
      "projetoItemId",
      "Relacione a categoria ou subcategoria com uma Categoria Omie e uma Conta Corrente Omie válidas antes de aprovar.",
    );
  }
  if (entrada.etapa === "Pagamento Ok" && !entrada.omieLiquidado) {
    erroCampo(
      "etapa",
      "O status Pagamento Ok é definido somente após a baixa confirmada no Omie.",
    );
  }
});

module.exports = { mapeamentoOmieValidoParaItem };
