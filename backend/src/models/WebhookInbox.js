"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const entry = defineModel({
  name: "WebhookInbox",
  singular: "webhookInbox",
  basePath: "/integracoes/webhooks",
  schema: {
    provider: fields.string({ required: true, label: "Provedor", default: "omie", searchable: true }),
    resource: fields.string({ label: "Recurso", searchable: true }),
    operation: fields.string({ label: "Operação", searchable: true }),
    eventType: fields.string({ label: "Evento", searchable: true }),
    externalEventId: fields.string({ label: "ID externo", searchable: true }),
    payload: { type: Object, required: true, __meta: { kind: "json", label: "Payload" } },
    payloadHash: fields.string({ required: true, label: "Hash", searchable: true }),
    receivedAt: fields.date({ required: true, label: "Recebido em" }),
    status: fields.enum(["Pendente", "Processando", "Concluído", "Erro"], {
      required: true,
      label: "Status",
      default: "Pendente",
    }),
    attempts: { type: Number, min: 0, default: 0, __meta: { kind: "number", label: "Tentativas" } },
    processedAt: fields.date({ label: "Processado em" }),
    lastError: fields.string({ label: "Último erro", searchable: true }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

entry.mongooseModel.schema.index({ provider: 1, payloadHash: 1 }, { unique: true });
entry.mongooseModel.schema.index({ provider: 1, status: 1, receivedAt: 1 });

module.exports = entry;
