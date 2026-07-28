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

const ROLES = ["admin", "desenvolvedor"];

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

function requireEnabledProvider(provider) {
  const enabled = typeof provider.enabled === "function"
    ? Boolean(provider.enabled())
    : provider.enabled !== false;
  if (!enabled) {
    throw new GenericError(`A integração ${provider.label} está desativada.`, {
      statusCode: 503,
    });
  }
}

function orderedResources(provider, { fullSyncOnly = false } = {}) {
  return (provider.resources || [])
    .filter((resource) => resource.syncHandler)
    .filter((resource) => !fullSyncOnly || resource.includeInFullSync !== false)
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
}

async function executeResource(providerKey, resource, payload = {}, options = {}) {
  const { handler } = resolveIntegrationHandler(providerKey, resource.syncHandler);
  return handler(
    {
      provider: providerKey,
      handler: resource.syncHandler,
      tipo: resource.syncHandler,
      resource: resource.key,
      operation: "sync",
      payload,
    },
    options,
  );
}

function statusCodeOf(error) {
  const informed = Number(error?.statusCode || error?.cause?.statusCode || 0);
  return informed >= 400 && informed <= 599 ? informed : 502;
}

function failurePayload(error, resource) {
  return {
    ok: false,
    resource,
    message: String(error?.message || "Falha na sincronização."),
    executionId: error?.executionId || null,
    technical: error?.technical || {
      requests: Array.isArray(error?.traces)
        ? error.traces
        : error?.trace
          ? [error.trace]
          : [],
      errors: [{
        erro: String(error?.message || "Falha na sincronização."),
        tipoErro: String(error?.name || "Error"),
        codigoErro: String(error?.code || ""),
        httpStatus: Number(error?.statusCode || 0),
      }],
    },
  };
}

defineRoutes("/integracoes", (router) => {
  router.private.get("/provedores", { roles: ROLES }, async (_req, res) => {
    res.json({ data: listIntegrationProviders() });
  });

  router.private.get("/catalogo", { roles: ROLES }, async (req, res) => {
    const provider = providerFrom(req);
    res.json({ provider, data: await catalogWithLatest(provider) });
  });

  router.private.get("/historico", { roles: ROLES }, async (req, res) => {
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
      roles: ROLES,
      audit: { entidade: "IntegrationExecution", acao: "sincronizar_recurso" },
    },
    async (req, res) => {
      const providerKey = providerFrom(req);
      const provider = getIntegrationProvider(providerKey);
      requireEnabledProvider(provider);
      const resource = orderedResources(provider).find(
        (item) => item.key === String(req.params.resource || "").trim().toLowerCase(),
      );
      if (!resource) {
        throw new GenericError("Recurso de integração não encontrado.", { statusCode: 404 });
      }
      try {
        const result = await executeResource(providerKey, resource, req.body || {}, {
          source: "manual",
          requestId: req.id,
        });
        res.json({ provider: providerKey, resource: resource.key, result });
      } catch (error) {
        res.status(statusCodeOf(error)).json(failurePayload(error, resource.key));
      }
    },
  );

  router.private.post(
    "/provedores/:provider/sincronizar-tudo",
    {
      roles: ROLES,
      audit: { entidade: "IntegrationExecution", acao: "sincronizar_tudo" },
    },
    async (req, res) => {
      const providerKey = providerFrom(req);
      const provider = getIntegrationProvider(providerKey);
      requireEnabledProvider(provider);
      const results = [];
      const errors = [];

      for (const resource of orderedResources(provider, { fullSyncOnly: true })) {
        try {
          const result = await executeResource(providerKey, resource, req.body || {}, {
            source: "manual-full-sync",
            requestId: req.id,
          });
          results.push({ resource: resource.key, label: resource.label, result });
        } catch (error) {
          errors.push({
            resource: resource.key,
            label: resource.label,
            ...failurePayload(error, resource.key),
          });
        }
      }

      const message = errors.length
        ? `${results.length} recurso(s) concluído(s) e ${errors.length} com erro.`
        : `${results.length} recurso(s) sincronizado(s) com sucesso.`;
      res.status(errors.length ? 207 : 200).json({
        provider: providerKey,
        ok: errors.length === 0,
        message,
        results,
        errors,
      });
    },
  );

  router.private.post(
    "/fila/processar",
    { roles: ROLES, audit: { entidade: "IntegrationOutbox", acao: "processar" } },
    async (req, res) => {
      res.json(await processIntegrationQueue({
        provider: providerFrom(req),
        limit: req.body?.limite,
      }));
    },
  );

  router.private.post(
    "/fila/:id/arquivar",
    { roles: ROLES, audit: { entidade: "IntegrationOutbox", acao: "arquivar_erro" } },
    async (req, res) => {
      res.json(await archiveIntegrationTicket(req.params.id, req.body?.motivo));
    },
  );

  router.private.post(
    "/fila/:id/reprocessar",
    { roles: ROLES, audit: { entidade: "IntegrationOutbox", acao: "reprocessar" } },
    async (req, res) => {
      res.json(await reprocessIntegrationTicket(req.params.id));
    },
  );
});
