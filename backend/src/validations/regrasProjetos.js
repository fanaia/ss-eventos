const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

async function registroAtivo(nomeModel, id, mensagem) {
  const registro = await model(nomeModel).findById(id).lean();
  if (!registro || registro.status === "Inativo") throw new GenericError(mensagem);
  return registro;
}

defineValidation("Projeto", async (dados) => {
  const cliente = await registroAtivo(
    "ClienteFornecedor",
    dados.clienteId,
    "Selecione um cliente ativo."
  );
  if (!cliente.cliente) throw new GenericError("O cadastro selecionado não está marcado como Cliente.");

  const fornecedor = await registroAtivo(
    "ClienteFornecedor",
    dados.fornecedorId,
    "Selecione um fornecedor ativo."
  );
  if (!fornecedor.fornecedor) {
    throw new GenericError("O cadastro selecionado não está marcado como Fornecedor.");
  }

  const contato = await registroAtivo("Contato", dados.contatoPrincipalId, "Selecione um contato ativo.");
  if (String(contato.clienteFornecedorId) !== String(dados.clienteId)) {
    throw new GenericError("O contato principal deve pertencer ao cliente selecionado.");
  }
});

defineValidation("ProjetoItem", async (dados) => {
  await registroAtivo("Projeto", dados.projetoId, "Selecione um projeto ativo.");
  await registroAtivo("Responsavel", dados.responsavelId, "Selecione um responsável ativo.");

  const estado = await registroAtivo("Estado", dados.estadoId, "Selecione um estado ativo.");
  const cidade = await registroAtivo("Cidade", dados.cidadeId, "Selecione uma cidade ativa.");
  if (String(cidade.estadoId) !== String(estado._id)) {
    throw new GenericError("A cidade selecionada não pertence ao estado informado.");
  }

  const categoria = await registroAtivo("Categoria", dados.categoriaId, "Selecione uma categoria ativa.");
  const subcategoria = await registroAtivo(
    "Categoria",
    dados.subcategoriaId,
    "Selecione uma subcategoria ativa."
  );
  if (String(subcategoria.categoriaPaiId || "") !== String(categoria._id)) {
    throw new GenericError("A subcategoria selecionada não pertence à categoria informada.");
  }
});

defineValidation("Pagamento", async (dados) => {
  const item = await model("ProjetoItem").findById(dados.projetoItemId).lean();
  if (!item) throw new GenericError("Item do projeto não encontrado.");
  if (String(item.projetoId) !== String(dados.projetoId)) {
    throw new GenericError("O pagamento deve estar vinculado ao mesmo projeto do item.");
  }

  const responsavel = await registroAtivo(
    "Responsavel",
    dados.responsavelPagamentoId,
    "Selecione um responsável de pagamento ativo."
  );
  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {
    throw new GenericError("O responsável selecionado não está habilitado para pagamentos.");
  }
});
