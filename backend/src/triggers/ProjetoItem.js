const { defineTrigger, registry, GenericError } = require("@oondemand/oon-core-back");
const { calcularValoresItem } = require("../services/calculosProjeto");

defineTrigger("ProjetoItem", {
  before: async (documento) => {
    const Projeto = registry.getModel("Projeto")?.mongooseModel;
    if (!Projeto) throw new GenericError("Model Projeto não registrada.");

    const projeto = await Projeto.findById(documento.projetoId).lean();
    if (!projeto) throw new GenericError("Projeto informado não foi encontrado.");

    const calculado = calcularValoresItem(documento.toObject(), projeto);
    for (const [campo, valor] of Object.entries(calculado)) {
      if (campo !== "_id" && campo !== "createdAt" && campo !== "updatedAt") documento.set(campo, valor);
    }
  },
});
