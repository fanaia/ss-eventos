"use strict";

const { processIntegrationQueue } = require("../integrations/runtime");
const { processarWebhooksPendentes } = require("../services/omieIntegration");
const { enfileirarIntegracao } = require("../models/IntegrationOutbox");
require("../integrations/omie/register");

const RECURSOS_MESTRES = [
  { handler: "OMIE_CATEGORIAS_IMPORTAR", resource: "categorias" },
  { handler: "OMIE_CONTAS_CORRENTES_IMPORTAR", resource: "contas-correntes" },
  { handler: "OMIE_CLIENTES_IMPORTAR", resource: "clientes-prestadores" },
];

function numeroEnv(nome, padrao) {
  const valor = Number(process.env[nome]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

async function enfileirarCargaMestre() {
  const janela = new Date().toISOString().slice(0, 10);
  await Promise.all(RECURSOS_MESTRES.map(({ handler, resource }) => enfileirarIntegracao({
    provider: "omie",
    handler,
    tipo: handler,
    resource,
    operation: "sync",
    aggregateType: "Omie",
    idempotencyKey: `omie:sync:${resource}:${janela}`,
    payload: { janela },
  })));
}

let executando = false;
let ultimaSync = 0;
let ultimaReconciliacao = 0;

async function ciclo() {
  if (
    executando
    || process.env.OMIE_ENABLED !== "true"
    || process.env.OMIE_WORKER_ENABLED === "false"
  ) {
    return;
  }

  executando = true;
  try {
    const agora = Date.now();
    const sync = numeroEnv("OMIE_MASTER_SYNC_INTERVAL_MS", 21600000);
    const reconciliacao = numeroEnv("OMIE_RECONCILE_INTERVAL_MS", 3600000);

    if (agora - ultimaSync >= sync) {
      await enfileirarCargaMestre();
      ultimaSync = agora;
    }

    if (agora - ultimaReconciliacao >= reconciliacao) {
      const janela = new Date().toISOString().slice(0, 13);
      await enfileirarIntegracao({
        provider: "omie",
        handler: "OMIE_FINANCEIRO_RECONCILIAR",
        tipo: "OMIE_FINANCEIRO_RECONCILIAR",
        resource: "contas-pagar",
        operation: "reconcile",
        aggregateType: "Pagamento",
        idempotencyKey: `omie:reconciliar:${janela}`,
        payload: { janela },
      });
      ultimaReconciliacao = agora;
    }

    await processarWebhooksPendentes({
      limite: numeroEnv("OMIE_WEBHOOK_BATCH_SIZE", 20),
    });
    await processIntegrationQueue({
      provider: "omie",
      limit: numeroEnv("OMIE_WORKER_BATCH_SIZE", 20),
    });
  } catch (erro) {
    console.error("[omie-worker]", erro?.message || erro);
  } finally {
    executando = false;
  }
}

if (
  process.env.OMIE_ENABLED === "true"
  && process.env.OMIE_WORKER_ENABLED !== "false"
) {
  const intervalo = numeroEnv("OMIE_WORKER_INTERVAL_MS", 60000);
  setTimeout(ciclo, Math.min(10000, intervalo)).unref();
  setInterval(ciclo, intervalo).unref();
}

module.exports = { ciclo, enfileirarCargaMestre };
