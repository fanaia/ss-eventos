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
    criados: number(result.criados),
    atualizados: number(result.atualizados),
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
    const result = await runner({ synchronizedAt: startedAt, executionId: execution._id });
    const concludedAt = new Date();
    const details = detailItems(result);
    execution.status = "Concluído";
    execution.concludedAt = concludedAt;
    execution.durationMs = concludedAt.getTime() - startedAt.getTime();
    execution.message = result?.message || `${title} concluída.`;
    execution.summary = summarize(result);
    execution.items = details.items;
    execution.itemCount = details.itemCount;
    execution.itemsLimited = details.limited;
    await execution.save();
    return { ...result, executionId: String(execution._id) };
  } catch (error) {
    const concludedAt = new Date();
    execution.status = "Erro";
    execution.concludedAt = concludedAt;
    execution.durationMs = concludedAt.getTime() - startedAt.getTime();
    execution.error = String(error?.message || "Falha desconhecida na integração.").slice(0, 4000);
    execution.message = `Falha em ${title}.`;
    await execution.save();
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
