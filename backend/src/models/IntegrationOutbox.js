"use strict";

const { defineModel, fields } = require("@oondemand/oon-core-back");

const TIPOS = [
  "OMIE_CLIENTE_UPSERT", "OMIE_CLIENTES_IMPORTAR", "OMIE_FORMAS_IMPORTAR",
  "OMIE_CATEGORIAS_IMPORTAR", "OMIE_CONTA_PAGAR_UPSERT",
  "OMIE_FINANCEIRO_RECONCILIAR", "OMIE_WEBHOOK_PROCESSAR",
];
const STATUS = ["Pendente", "Processando", "Erro temporário", "Concluído", "Erro definitivo"];

const entry = defineModel({
  name: "IntegrationOutbox", singular: "integrationOutbox", basePath: "/integracoes/fila",
  schema: {
    tipo: fields.enum(TIPOS, { required: true, label: "Tipo" }),
    aggregateType: fields.string({ label: "Entidade" }),
    aggregateId: fields.string({ label: "ID da entidade", searchable: true }),
    idempotencyKey: fields.string({ required: true, label: "Chave de idempotência", searchable: true }),
    payload: { type: Object, default: {}, __meta: { kind: "json", label: "Payload" } },
    status: fields.enum(STATUS, { required: true, label: "Status", default: "Pendente" }),
    tentativas: { type: Number, min: 0, default: 0, __meta: { kind: "number", label: "Tentativas" } },
    proximaTentativaEm: fields.date({ label: "Próxima tentativa" }),
    lockedAt: fields.date({ label: "Bloqueado em" }), lockedBy: fields.string({ label: "Bloqueado por" }),
    ultimoErro: fields.string({ label: "Último erro", searchable: true }),
    responseSummary: { type: Object, default: {}, __meta: { kind: "json", label: "Resumo da resposta" } },
    concluidoEm: fields.date({ label: "Concluído em" }),
  },
  crud: { enabled: true, roles: { write: ["desenvolvedor"] } },
});

const Model = entry.mongooseModel;
Model.schema.index({ idempotencyKey: 1 }, { unique: true });
Model.schema.index({ status: 1, proximaTentativaEm: 1, createdAt: 1 });

async function enfileirarIntegracao({ tipo, aggregateType, aggregateId, idempotencyKey, payload = {} }) {
  return Model.findOneAndUpdate({ idempotencyKey }, { $setOnInsert: {
    tipo, aggregateType, aggregateId: aggregateId ? String(aggregateId) : undefined,
    idempotencyKey, payload, status: "Pendente", tentativas: 0, proximaTentativaEm: new Date(),
  } }, { upsert: true, new: true, setDefaultsOnInsert: true });
}
function atrasoTentativa(tentativas) {
  const minutos = [1, 5, 15, 60, 360];
  return minutos[Math.min(Math.max(0, tentativas - 1), minutos.length - 1)] * 60000;
}
module.exports = { TIPOS, STATUS, enfileirarIntegracao, atrasoTentativa };
