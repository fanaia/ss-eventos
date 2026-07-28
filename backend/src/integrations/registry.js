"use strict";

const { GenericError } = require("@oondemand/oon-core-back");

const providers = new Map();

function normalizeKey(value, field = "identificador") {
  const key = String(value || "").trim().toLowerCase();
  if (!key) {
    throw new GenericError(`Informe o ${field} da integração.`, { statusCode: 500 });
  }
  return key;
}

function normalizeResources(resources = []) {
  return resources.map((resource, index) => ({
    ...resource,
    key: normalizeKey(resource.key, `identificador do recurso ${index + 1}`),
    order: Number(resource.order ?? resource.ordem ?? (index + 1) * 10),
  }));
}

function registerIntegrationProvider(definition = {}) {
  const key = normalizeKey(definition.key, "identificador do provedor");
  const current = providers.get(key) || {};
  const normalized = {
    ...current,
    ...definition,
    key,
    label: String(definition.label || current.label || key),
    resources: normalizeResources(definition.resources || current.resources || []),
    handlers: {
      ...(current.handlers || {}),
      ...(definition.handlers || {}),
    },
  };
  providers.set(key, normalized);
  return normalized;
}

function getIntegrationProvider(key) {
  const normalized = normalizeKey(key, "identificador do provedor");
  const provider = providers.get(normalized);
  if (!provider) {
    throw new GenericError(`Provedor de integração não registrado: ${normalized}.`, {
      statusCode: 404,
    });
  }
  return provider;
}

function listIntegrationProviders() {
  return [...providers.values()]
    .map((provider) => ({
      key: provider.key,
      label: provider.label,
      description: provider.description || "",
      enabled: typeof provider.enabled === "function"
        ? Boolean(provider.enabled())
        : provider.enabled !== false,
      resources: provider.resources || [],
    }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
}

function resolveIntegrationHandler(providerKey, handlerKey) {
  const provider = getIntegrationProvider(providerKey);
  const handler = provider.handlers?.[handlerKey];
  if (typeof handler !== "function") {
    throw new GenericError(
      `Operação ${handlerKey || "não informada"} não registrada para ${provider.label}.`,
      { statusCode: 422 },
    );
  }
  return { provider, handler };
}

module.exports = {
  getIntegrationProvider,
  listIntegrationProviders,
  registerIntegrationProvider,
  resolveIntegrationHandler,
};
