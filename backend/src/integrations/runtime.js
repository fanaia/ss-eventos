"use strict";

const os = require("node:os");
const { registry, GenericError } = require("@oondemand/oon-core-back");
const { resolveIntegrationHandler, getIntegrationProvider } = require("./registry");

function model(name) {
  const Model = registry.getModel(name)?.mongooseModel;
  if (!Model) throw new GenericError(`Model ${name} não registrada.`);
  return Model;
}

function errorMessage(error) {
  return String(error?.message || error || "Falha desconhecida na integração.").slice(0, 4000);
}

function retryDelay(attempts) {
  const minutes = [1, 5, 15, 60, 360];
  return minutes[Math.min(Math.max(0, Number(attempts || 1) - 1), minutes.length - 1)] * 60000;
}

function providerFilter(provider) {
  if (!provider) return {};
  if (provider === "omie") {
    return { $or: [{ provider }, { provider: { $exists: false } }, { provider: "" }] };
  }
  return { provider };
}

async function refreshProvider(providerKey) {
  if (!providerKey) return null;
  const provider = getIntegrationProvider(providerKey);
  return typeof provider.refreshDashboard === "function"
    ? provider.refreshDashboard()
    : null;
}

async function processIntegrationQueue(options = {}) {
  const Outbox = model("IntegrationOutbox");
  const worker = `${os.hostname()}:${process.pid}`;
  const limit = Math.min(100, Math.max(1, Number(options.limit || 20)));
  const providerKey = String(options.provider || "omie").trim().toLowerCase();
  const errors = [];
  let processed = 0;

  for (let index = 0; index < limit; index += 1) {
    const now = new Date();
    const event = await Outbox.findOneAndUpdate(
      {
        ...providerFilter(providerKey),
        status: { $in: ["Pendente", "Erro temporário"] },
        $and: [
          {
            $or: [
              { proximaTentativaEm: { $lte: now } },
              { proximaTentativaEm: null },
              { proximaTentativaEm: { $exists: false } },
            ],
          },
          {
            $or: [
              { lockedAt: { $lt: new Date(Date.now() - 600000) } },
              { lockedAt: null },
              { lockedAt: { $exists: false } },
            ],
          },
        ],
      },
      {
        $set: {
          provider: providerKey,
          status: "Processando",
          lockedAt: now,
          lockedBy: worker,
        },
        $inc: { tentativas: 1 },
      },
      { sort: { createdAt: 1 }, new: true },
    ).lean();

    if (!event) break;

    const handlerKey = event.handler || event.tipo;
    try {
      const { provider, handler } = resolveIntegrationHandler(providerKey, handlerKey);
      if (typeof provider.enabled === "function" && !provider.enabled()) {
        throw new GenericError(`A integração ${provider.label} está desativada.`, {
          statusCode: 503,
        });
      }
      const response = await handler(event, options);
      await Outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: "Concluído",
            concluidoEm: new Date(),
            responseSummary: response || {},
            ultimoErro: "",
            lockedAt: null,
            lockedBy: "",
          },
        },
      );
      processed += 1;
    } catch (error) {
      const provider = getIntegrationProvider(providerKey);
      const attempts = Number(event.tentativas || 1);
      const retryable = typeof provider.isRetryable === "function"
        ? provider.isRetryable(error)
        : error?.retryable !== false;
      const definitive = attempts >= Number(provider.maxAttempts || 5) || !retryable;
      const message = errorMessage(error);
      await Outbox.updateOne(
        { _id: event._id },
        {
          $set: {
            status: definitive ? "Erro definitivo" : "Erro temporário",
            ultimoErro: message,
            proximaTentativaEm: definitive ? null : new Date(Date.now() + retryDelay(attempts)),
            lockedAt: null,
            lockedBy: "",
          },
        },
      );
      errors.push({ id: String(event._id), handler: handlerKey, error: message });
    }
  }

  await refreshProvider(providerKey);
  return { provider: providerKey, processed, errors };
}

async function archiveIntegrationTicket(id, reason) {
  const Outbox = model("IntegrationOutbox");
  const ticket = await Outbox.findById(id).lean();
  if (!ticket) throw new GenericError("Ticket de integração não encontrado.", { statusCode: 404 });
  if (!["Erro temporário", "Erro definitivo"].includes(ticket.status)) {
    throw new GenericError("Somente tickets com erro podem ser arquivados.", { statusCode: 409 });
  }
  const updated = await Outbox.findByIdAndUpdate(
    id,
    {
      $set: {
        statusAnterior: ticket.status,
        status: "Arquivado",
        arquivadoEm: new Date(),
        motivoArquivamento: String(reason || "Erro reconhecido e arquivado manualmente.").slice(0, 500),
        lockedAt: null,
        lockedBy: "",
        proximaTentativaEm: null,
      },
    },
    { new: true },
  );
  await refreshProvider(ticket.provider || "omie");
  return updated;
}

async function reprocessIntegrationTicket(id) {
  const Outbox = model("IntegrationOutbox");
  const ticket = await Outbox.findById(id).lean();
  if (!ticket) throw new GenericError("Ticket de integração não encontrado.", { statusCode: 404 });
  if (!["Erro temporário", "Erro definitivo", "Arquivado"].includes(ticket.status)) {
    throw new GenericError("Este ticket não permite reprocessamento.", { statusCode: 409 });
  }
  const updated = await Outbox.findByIdAndUpdate(
    id,
    {
      $set: {
        provider: ticket.provider || "omie",
        status: "Pendente",
        statusAnterior: ticket.status,
        tentativas: 0,
        proximaTentativaEm: new Date(),
        ultimoErro: "",
        arquivadoEm: null,
        motivoArquivamento: "",
        lockedAt: null,
        lockedBy: "",
      },
    },
    { new: true },
  );
  await refreshProvider(ticket.provider || "omie");
  return updated;
}

module.exports = {
  archiveIntegrationTicket,
  processIntegrationQueue,
  refreshProvider,
  reprocessIntegrationTicket,
  retryDelay,
};
