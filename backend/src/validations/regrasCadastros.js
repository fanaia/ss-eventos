const { defineValidation, registry, GenericError } = require("@oondemand/oon-core-back");

function model(nome) {
  const Model = registry.getModel(nome)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${nome} não registrada.`);
  return Model;
}

defineValidation("ClienteFornecedor", async (dados) => {
  if (!dados.cliente && !dados.fornecedor) {
    throw new GenericError("Marque o cadastro como Cliente, Fornecedor ou ambos.");
  }
});

defineValidation("Categoria", async (dados) => {
  if (dados._id && dados.categoriaPaiId && String(dados._id) === String(dados.categoriaPaiId)) {
    throw new GenericError("Uma categoria não pode ser sua própria categoria pai.");
  }
});

defineValidation("Cidade", async (dados) => {
  if (!dados.estadoId) return;
  const estado = await model("Estado").findById(dados.estadoId).lean();
  if (!estado || estado.status === "Inativo") {
    throw new GenericError("Selecione um estado ativo para a cidade.");
  }
});
