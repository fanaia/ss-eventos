const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

function erroCampo(field, message) {
  throw new GenericError(message, {
    details: { field, message },
  });
}

async function registroAtivo(nomeModel, id, field, mensagem) {
  if (!id) erroCampo(field, mensagem);
  const registro = await model(nomeModel).findById(id).lean();
  if (!registro || registro.status === "Inativo") erroCampo(field, mensagem);
  return registro;
}

defineValidation("Projeto", async (dados) => {
  const cliente = await registroAtivo(
    "ClienteFornecedor",
    dados.clienteId,
    "clienteId",
    "Selecione um cliente ativo."
  );
  if (!cliente.cliente) {
    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");
  }

  const fornecedor = await registroAtivo(
    "ClienteFornecedor",
    dados.fornecedorId,
    "fornecedorId",
    "Selecione um fornecedor ativo."
  );
  if (!fornecedor.fornecedor) {
    erroCampo("fornecedorId", "O cadastro selecionado não está marcado como Fornecedor.");
  }

  const contato = await registroAtivo(
    "Contato",
    dados.contatoPrincipalId,
    "contatoPrincipalId",
    "Selecione um contato ativo."
  );
  if (String(contato.clienteFornecedorId) !== String(dados.clienteId)) {
    erroCampo("contatoPrincipalId", "O contato principal deve pertencer ao cliente selecionado.");
  }
});

defineValidation("ProjetoItem", async (dados) => {
  await registroAtivo("Projeto", dados.projetoId, "projetoId", "Selecione um projeto ativo.");
  await registroAtivo("Responsavel", dados.responsavelId, "responsavelId", "Selecione um responsável ativo.");

  const estado = await registroAtivo("Estado", dados.estadoId, "estadoId", "Selecione um estado ativo.");
  const cidade = await registroAtivo("Cidade", dados.cidadeId, "cidadeId", "Selecione uma cidade ativa.");
  if (String(cidade.estadoId) !== String(estado._id)) {
    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");
  }

  const categoria = await registroAtivo("Categoria", dados.categoriaId, "categoriaId", "Selecione uma categoria ativa.");
  if (categoria.categoriaPaiId) {
    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");
  }
  const subcategoria = await registroAtivo(
    "Categoria",
    dados.subcategoriaId,
    "subcategoriaId",
    "Selecione uma subcategoria ativa."
  );
  if (String(subcategoria.categoriaPaiId || "") !== String(categoria._id)) {
    erroCampo("subcategoriaId", "A subcategoria selecionada não pertence à categoria informada.");
  }
});

defineValidation("Pagamento", async (dados) => {
  const item = await model("ProjetoItem").findById(dados.projetoItemId).lean();
  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");
  if (String(item.projetoId) !== String(dados.projetoId)) {
    erroCampo("projetoItemId", "O pagamento deve estar vinculado ao mesmo projeto do item.");
  }

  const responsavel = await registroAtivo(
    "Responsavel",
    dados.responsavelPagamentoId,
    "responsavelPagamentoId",
    "Selecione um responsável de pagamento ativo."
  );
  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {
    erroCampo("responsavelPagamentoId", "O responsável selecionado não está habilitado para pagamentos.");
  }
});
