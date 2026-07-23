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

defineValidation("Projeto", async (dados, contexto) => {
  const efetivos = dadosConsolidados(dados, contexto);

  const cliente = await registroAtivo(
    "ClienteFornecedor",
    efetivos.clienteId,
    "clienteId",
    "Selecione um cliente ativo."
  );
  if (!cliente.cliente) {
    erroCampo("clienteId", "O cadastro selecionado não está marcado como Cliente.");
  }

  const fornecedor = await registroAtivo(
    "ClienteFornecedor",
    efetivos.fornecedorId,
    "fornecedorId",
    "Selecione um fornecedor ativo."
  );
  if (!fornecedor.fornecedor) {
    erroCampo("fornecedorId", "O cadastro selecionado não está marcado como Fornecedor.");
  }

  const contato = await registroAtivo(
    "Contato",
    efetivos.contatoPrincipalId,
    "contatoPrincipalId",
    "Selecione um contato ativo."
  );
  if (String(contato.clienteFornecedorId) !== String(efetivos.clienteId)) {
    erroCampo("contatoPrincipalId", "O contato principal deve pertencer ao cliente selecionado.");
  }
});

defineValidation("ProjetoItem", async (dados, contexto) => {
  const efetivos = dadosComDependenciaOpcional(
    dados,
    contexto,
    "categoriaId",
    "subcategoriaId",
  );

  await registroAtivo("Projeto", efetivos.projetoId, "projetoId", "Selecione um projeto ativo.");
  await registroAtivo("Responsavel", efetivos.responsavelId, "responsavelId", "Selecione um responsável ativo.");

  const estado = await registroAtivo("Estado", efetivos.estadoId, "estadoId", "Selecione um estado ativo.");
  const cidade = await registroAtivo("Cidade", efetivos.cidadeId, "cidadeId", "Selecione uma cidade ativa.");
  if (String(cidade.estadoId) !== String(estado._id)) {
    erroCampo("cidadeId", "A cidade selecionada não pertence ao estado informado.");
  }

  const categoria = await registroAtivo("Categoria", efetivos.categoriaId, "categoriaId", "Selecione uma categoria ativa.");
  if (categoria.categoriaPaiId) {
    erroCampo("categoriaId", "Selecione uma categoria principal, sem categoria pai.");
  }

  if (efetivos.subcategoriaId) {
    const subcategoria = await registroAtivo(
      "Categoria",
      efetivos.subcategoriaId,
      "subcategoriaId",
      "Selecione uma subcategoria ativa."
    );

    // O formulário limpa visualmente a subcategoria ao trocar a categoria, mas
    // versões anteriores do Core ainda podem enviar o id antigo no payload. O
    // model normaliza esse valor para null antes de persistir.
    if (!subcategoriaPertenceACategoria(categoria._id, subcategoria)) return;
  }
});

defineValidation("Pagamento", async (dados, contexto) => {
  const efetivos = dadosConsolidados(dados, contexto);

  const item = await model("ProjetoItem").findById(efetivos.projetoItemId).lean();
  if (!item) erroCampo("projetoItemId", "Item do projeto não encontrado.");
  if (String(item.projetoId) !== String(efetivos.projetoId)) {
    erroCampo("projetoItemId", "O pagamento deve estar vinculado ao mesmo projeto do item.");
  }

  const responsavel = await registroAtivo(
    "Responsavel",
    efetivos.responsavelPagamentoId,
    "responsavelPagamentoId",
    "Selecione um responsável de pagamento ativo."
  );
  if (!["Pagamento", "Ambos"].includes(responsavel.tipo)) {
    erroCampo("responsavelPagamentoId", "O responsável selecionado não está habilitado para pagamentos.");
  }
});