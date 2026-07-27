"use strict";
const {processarFila,processarWebhooksPendentes,enfileirarSincronizacaoCompleta}=require("../services/omieIntegration");
const {enfileirarIntegracao}=require("../models/IntegrationOutbox");
function numeroEnv(nome,padrao){const valor=Number(process.env[nome]);return Number.isFinite(valor)&&valor>0?valor:padrao;}
let executando=false,ultimaSync=0,ultimaReconciliacao=0;
async function ciclo(){if(executando||process.env.OMIE_ENABLED!=="true"||process.env.OMIE_WORKER_ENABLED==="false")return;executando=true;try{const agora=Date.now(),sync=numeroEnv("OMIE_MASTER_SYNC_INTERVAL_MS",21600000),recon=numeroEnv("OMIE_RECONCILE_INTERVAL_MS",3600000);if(agora-ultimaSync>=sync){await enfileirarSincronizacaoCompleta();ultimaSync=agora;}if(agora-ultimaReconciliacao>=recon){const janela=new Date().toISOString().slice(0,13);await enfileirarIntegracao({tipo:"OMIE_FINANCEIRO_RECONCILIAR",aggregateType:"Pagamento",idempotencyKey:`omie:reconciliar:${janela}`,payload:{janela}});ultimaReconciliacao=agora;}await processarWebhooksPendentes({limite:numeroEnv("OMIE_WEBHOOK_BATCH_SIZE",20)});await processarFila({limite:numeroEnv("OMIE_WORKER_BATCH_SIZE",20)});}catch(erro){console.error("[omie-worker]",erro?.message||erro);}finally{executando=false;}}
if(process.env.OMIE_ENABLED==="true"&&process.env.OMIE_WORKER_ENABLED!=="false"){const intervalo=numeroEnv("OMIE_WORKER_INTERVAL_MS",60000);setTimeout(ciclo,Math.min(10000,intervalo)).unref();setInterval(ciclo,intervalo).unref();}
module.exports={ciclo};
