"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const rawObject = (label, defaultValue = {}) => ({
  type: Object,
  default: defaultValue,
  __meta: { kind: "json", label, readonly: true, readOnly: true },
});

const rawArray = (label) => ({
  type: [Object],
  default: [],
  __meta: { kind: "json", label, readonly: true, readOnly: true },
});

const entry = defineModel({
  name: "IntegrationExecution",
  singular: "integrationExecution",
  basePath: "/integracoes/historico",
  schema: {
    provider: fields.string({ required: true, label: "Provedor", searchable: true }),
    resource: fields.string({ required: true, label: "Recurso", searchable: true }),
    operation: fields.string({ required: true, label: "Operação", default: "sync" }),
    title: fields.string({ required: true, label: "Execução", searchable: true }),
    status: fields.enum(
      ["Executando", "Concluído", "Concluído com erros", "Erro"],
      {
        required: true,
        label: "Status",
        default: "Executando",
      },
    ),
    startedAt: fields.date({ required: true, label: "Iniciado em" }),
    concludedAt: fields.date({ label: "Concluído em" }),
    durationMs: fields.number({ label: "Duração (ms)", default: 0 }),
    message: fields.string({ label: "Mensagem" }),
    error: fields.string({ label: "Erro", searchable: true }),
    summary: rawObject("Resumo"),
    metadata: rawObject("Metadados"),
    requests: rawArray("Requisições ao provedor"),
    errors: rawArray("Erros detalhados"),
    items: rawArray("Itens processados"),
    itemCount: fields.number({ label: "Total de itens", default: 0 }),
    itemsLimited: fields.boolean({ label: "Amostra limitada", default: false }),
  },
  options: { collection: "integration_executions" },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

entry.mongooseModel.schema.index({ provider: 1, resource: 1, startedAt: -1 });
entry.mongooseModel.schema.index({ status: 1, startedAt: -1 });

module.exports = entry;
