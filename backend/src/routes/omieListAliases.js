"use strict";

const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");

function model(name) {
  const Model = registry.getModel(name)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${name} não registrada.`);
  return Model;
}

function escaped(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

defineRoutes("/integracoes/omie/listas", (router) => {
  router.private.get("/contas", { roles: ["admin", "desenvolvedor"] }, async (req, res) => {
    const query = String(req.query?.q || "").trim();
    const filter = { status: "Ativo" };
    if (query) {
      const expression = new RegExp(escaped(query), "i");
      filter.$or = ["descricao", "codigoIntegracao", "codigoBanco", "numeroConta"]
        .map((field) => ({ [field]: expression }));
    }
    const data = await model("OmieContaCorrente")
      .find(filter)
      .select("codigo codigoIntegracao descricao tipo codigoBanco codigoAgencia numeroConta inativa bloqueada status sincronizadoEm")
      .sort({ descricao: 1, codigo: 1 })
      .limit(300)
      .lean();
    res.json({ data });
  });
});
