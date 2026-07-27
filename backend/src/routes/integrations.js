"use strict";

const { defineRoutes, registry, GenericError } = require("@oondemand/oon-core-back");
const {
  getIntegrationProvider,
  listIntegrationProviders,
  resolveIntegrationHandler,
} = require("../integrations/registry");
const { catalogWithLatest } = require("../integrations/history");
const {
  archiveIntegrationTicket,
  processIntegrationQueue,
  reprocessIntegrationTicket,
} = require("../integrations/runtime");
require("../integrations/omie/register");

function model(name) {
  const Model = registry.getModel(name)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${name} não registrada.`);
  return Model;
}

function providerFrom(request) {
  return String(
    request.params?.provider || request.body?.provider || request.query?.provider || "omie",
  ).trim().toLowerCase();
}

defineRoutes("/integracoes", (router) => {
  router.private.get("/provedores", { roles: ["desenvolvedor"] }, async (_req, res) => {
    res.json({ data: listIntegrationProviders() });
  });

  router.private.get("/catalogo", { roles: ["desenvolvedor"] }, async (req, res) => {
    const provider = providerFrom(req);
    res.json({ provider, data: await catalogWithLatest(provider) });
  });

  router.private.get("/historico", { roles: ["desenvolvedor"] }, async (req, res) => {
    const provider = providerFrom(req);
    const pageIndex = Math.max(0, Number(req.query?.pageIndex || 0));
    const pageSize = Math.min(100, Math.max(1, Number(req.query?.pageSize || 20)));
    const filter = { provider };
    if (req.query?.resource) filter.resource = String(req.query.resource);
    if (req.query?.status) filter.status = String(req.query.status);
    const [data, total] = await Promise.all([
      model("IntegrationExecution")
        .find(filter)
        .sort({ startedAt: -1 })
        .skip(pageIndex * pageSize)
        .limit(pageSize)
        .lean(),
      model("IntegrationExecution").countDocuments(filter),
    ]);
    res.json({ data, total, pageIndex, pageSize });
  });

  router.private.post(
    "/provedores/:provider/recursos/:resource/sincronizar",
    {
      roles: ["desenvolvedor"],
      audit: { entidade: "IntegrationExecution", acao: "sincronizar_recurso" },
    },
    async (req, res) => {
      const providerKey = providerFrom(req);
      const provider = getIntegrationProvider(providerKey);
      const resource = (provider.resources || []).find(
        (item) => item.key === String(req.params.resource || "").trim().toLowerCase(),
      );
      if (!resource) {
        throw new GenericError("Recurso de integração não encontrado.", { statusCode: 404 });
      }
      if (!resource.syncHandler) {
        throw new GenericError("Este recurso não possui sincronização manual.", { statusCode: 422 });
      }
      const { handler } = resolveIntegrationHandler(providerKey, resource.syncHandler);
      const result = await handler(
        {
          provider: providerKey,
          handler: resource.syncHandler,
          tipo: resource.syncHandler,
          resource: resource.key,
          operation: "sync",
          payload: req.body || {},
        },
        { source: "manual", requestId: req.id },
      );
      res.json({ provider: providerKey, resource: resource.key, result });
    },
  );

  router.private.post(
    "/fila/processar",
    { roles: ["desenvolvedor"], audit: { entidade: "IntegrationOutbox", acao: "processar" } },
    async (req, res) => {
      res.json(await processIntegrationQueue({
        provider: providerFrom(req),
        limit: req.body?.limite,
      }));
    },
  );

  router.private.post(
    "/fila/:id/arquivar",
    { roles: ["desenvolvedor"], audit: { entidade: "IntegrationOutbox", acao: "arquivar_erro" } },
    async (req, res) => {
      res.json(await archiveIntegrationTicket(req.params.id, req.body?.motivo));
    },
  );

  router.private.post(
    "/fila/:id/reprocessar",
    { roles: ["desenvolvedor"], audit: { entidade: "IntegrationOutbox", acao: "reprocessar" } },
    async (req, res) => {
      res.json(await reprocessIntegrationTicket(req.params.id));
    },
  );
});
