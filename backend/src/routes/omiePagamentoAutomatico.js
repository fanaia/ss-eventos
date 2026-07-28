"use strict";

const { defineRoutes } = require("@oondemand/oon-core-back");
const {
  conciliarPagamentoAutomatico,
} = require("../services/omiePagamentoAutomatico");

const ROLES = ["admin", "desenvolvedor"];

defineRoutes("/integracoes/omie/automatico", (router) => {
  router.private.post(
    "/pagamentos/:id/conciliar",
    {
      roles: ROLES,
      audit: { entidade: "Pagamento", acao: "conciliar_omie" },
    },
    async (req, res) => {
      res.json(await conciliarPagamentoAutomatico(req.params.id));
    },
  );
});
