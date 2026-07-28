"use strict";

const { registry, GenericError } = require("@oondemand/oon-core-back");
const { getIntegrationProvider } = require("./registry");

function model(name) {
  const Model = registry.getModel(name)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${name} não registrada.`);
  return Model;
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function summarize(result = {}) {
  return {
    totalRecebidos: number(result.totalRecebidos ?? result.encontrados),
    totalInformadoPeloProvedor: number(
      result.totalInformadoPeloProvedor ?? result.totalInformadoPeloOmie,
    ),
    paginas: number(result.paginas),
    processados: number(result.processados),
    sucessos: number(result.sucessos),
    criados: number(result.criados),
    atualizados: number(result.atualizados),
    conflitos: number(result.conflitos),
    semAlteracao: number(result.semAlteracao),
    ignorados: number(result.ignorados),
    removidos: number(result.removidos),
    erros: Array.isArray(result.erros) ? result.erros.length : number(result.erros),
  };
}

function historyItemLimit() {
  const configured = Number(process.env.INTEGRATION_HISTORY_ITEM_LIMIT);
  if (!Number.isFinite(configured) || configured <= 0) return 500;
  return Math.min(2000, Math.max(1, Math.floor(configured)));
}

function detailItems(result = {}) {
  const items = Array.isArray(result.itens)
    ? result.itens
    : Array.isArray(result.items)
      ? result.items
      : [];
  const limit = historyItemLimit();
  return {
    items: items.slice(0, limit),
    itemCount: items.length,
    limited: items.length > limit,
  };
}

function requestsOf(value = {}) {
  if (Array.isArray(value?.requisicoes)) return value.requisicoes;
  if (Array.isArray(value?.requests)) return value.requests;
  if (Array.isArray(value?.traces)) return value.traces;
  if (value?.trace) return [value.trace];
  return [];
}

function errorsOf(value = {}) {
  if (Array.isArray(value?.erros)) return value.erros;
  if (Array.isArray(value?.errors)) return value.errors;
  return [];
}

async function runTrackedSynchronization({
  provider,
  resource,
  operation = "sync",
  title,
  runner,
  metadata = {},
}) {
  const Execution = model("IntegrationExecution");
  const startedAt = new Date();
  const execution = await Execution.create({
    provider,
    resource,
    operation,
    title,
    status: "Executando",
    startedAt,
    metadata,
  });

  try {
    const result = await runner({
      synchronizedAt: startedAt,
      executionId: execution._id,
    });
    const concludedAt = new Date();
    const details = detailItems(result);
    const errors = errorsOf(result);
    const conflicts = number(result?.conflitos);
    execution.status = errors.length || conflicts
      ? "Concluído com erros"
      : "Concluído";
    execution.concludedAt = concludedAt;
    execution.durationMs = concludedAt.getTime() - startedAt.getTime();
    execution.message = result?.message || `${title} concluída.`;
    execution.error = errors.length
      ? String(errors[0]?.erro || errors[0]?.error || "Existem registros com erro.").slice(0, 4000)
      : conflicts
        ? `${conflicts} cadastro(s) com conflito de alterações.`
        : "";
    execution.summary = summarize(result);
    execution.requests = requestsOf(result);
    execution.errors = errors;
    execution.items = details.items;
    execution.itemCount = details.itemCount;
    execution.itemsLimited = details.limited;
    await execution.save();
    return { ...result, executionId: String(execution._id) };
  } catch (caught) {
    const original = caught && typeof caught === "object" ? caught : null;
    const error = caught instanceof Error
      ? caught
      : new Error(String(caught || "Falha desconhecida na integração."));
    if (original && error !== original) {
      error.code = original.code;
      error.statusCode = original.statusCode;
      error.trace = original.trace;
      error.traces = original.traces;
    }
    const concludedAt = new Date();
    execution.status = "Erro";
    execution.concludedAt = concludedAt;
    execution.durationMs = concludedAt.getTime() - startedAt.getTime();
    execution.error = String(error.message || "Falha desconhecida na integração.").slice(0, 4000);
    execution.message = `Falha em ${title}.`;
    execution.requests = requestsOf(original || error);
    execution.errors = [{
      erro: execution.error,
      tipoErro: String(error.name || "Error"),
      codigoErro: String(error.code || ""),
      httpStatus: number(error.statusCode),
    }];
    await execution.save();
    error.executionId = String(execution._id);
    error.technical = {
      requests: execution.requests,
      errors: execution.errors,
    };
    throw error;
  }
}

async function catalogWithLatest(providerKey) {
  const provider = getIntegrationProvider(providerKey);
  const Execution = model("IntegrationExecution");
  const latest = await Execution.aggregate([
    { $match: { provider: provider.key } },
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: "$resource",
        execution: { $first: "$$ROOT" },
      },
    },
  ]);
  const byResource = new Map(latest.map((item) => [item._id, item.execution]));
  return (provider.resources || [])
    .map((resource) => ({
      ...resource,
      provider: provider.key,
      providerLabel: provider.label,
      latestExecution: byResource.get(resource.key) || null,
    }))
    .sort((left, right) => left.order - right.order);
}

module.exports = {
  catalogWithLatest,
  historyItemLimit,
  runTrackedSynchronization,
  summarize,
};
