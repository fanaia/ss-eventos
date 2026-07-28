"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const STATUS = [
  "Pendente",
  "Processando",
  "Erro temporário",
  "Concluído",
  "Erro definitivo",
  "Arquivado",
];

const entry = defineModel({
  name: "IntegrationOutbox",
  singular: "integrationOutbox",
  basePath: "/integracoes/fila",
  schema: {
    provider: fields.string({ required: true, label: "Provedor", default: "omie", searchable: true }),
    handler: fields.string({ required: true, label: "Operação técnica", searchable: true }),
    tipo: fields.string({ required: true, label: "Tipo", searchable: true }),
    resource: fields.string({ label: "Recurso", searchable: true }),
    operation: fields.string({ label: "Operação", default: "sync", searchable: true }),
    aggregateType: fields.string({ label: "Entidade", searchable: true }),
    aggregateId: fields.string({ label: "ID da entidade", searchable: true }),
    idempotencyKey: fields.string({ required: true, label: "Chave de idempotência", searchable: true }),
    payload: { type: Object, default: {}, __meta: { kind: "json", label: "Payload" } },
    status: fields.enum(STATUS, { required: true, label: "Status", default: "Pendente" }),
    statusAnterior: fields.string({ label: "Status anterior" }),
    tentativas: { type: Number, min: 0, default: 0, __meta: { kind: "number", label: "Tentativas" } },
    proximaTentativaEm: fields.date({ label: "Próxima tentativa" }),
    lockedAt: fields.date({ label: "Bloqueado em" }),
    lockedBy: fields.string({ label: "Bloqueado por" }),
    ultimoErro: fields.string({ label: "Último erro", searchable: true }),
    responseSummary: { type: Object, default: {}, __meta: { kind: "json", label: "Resumo da resposta" } },
    concluidoEm: fields.date({ label: "Concluído em" }),
    arquivadoEm: fields.date({ label: "Arquivado em" }),
    motivoArquivamento: fields.string({ label: "Motivo do arquivamento", searchable: true }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
Model.schema.index({ idempotencyKey: 1 }, { unique: true });
Model.schema.index({ provider: 1, status: 1, proximaTentativaEm: 1, createdAt: 1 });

async function enfileirarIntegracao({
  provider = "omie",
  handler,
  tipo,
  resource,
  operation = "sync",
  aggregateType,
  aggregateId,
  idempotencyKey,
  payload = {},
}) {
  const operationHandler = String(handler || tipo || "").trim();
  if (!operationHandler) throw new Error("Informe o handler da integração.");
  return Model.findOneAndUpdate(
    { idempotencyKey },
    {
      $setOnInsert: {
        provider: String(provider || "omie").trim().toLowerCase(),
        handler: operationHandler,
        tipo: String(tipo || operationHandler),
        resource: resource ? String(resource) : undefined,
        operation,
        aggregateType,
        aggregateId: aggregateId ? String(aggregateId) : undefined,
        idempotencyKey,
        payload,
        status: "Pendente",
        tentativas: 0,
        proximaTentativaEm: new Date(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

function atrasoTentativa(tentativas) {
  const minutos = [1, 5, 15, 60, 360];
  return minutos[Math.min(Math.max(0, tentativas - 1), minutos.length - 1)] * 60000;
}

module.exports = { STATUS, enfileirarIntegracao, atrasoTentativa };
