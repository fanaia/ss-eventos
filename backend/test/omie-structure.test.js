"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const raiz = path.resolve(__dirname, "../..");
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), "utf8");

test("integração usa outbox, inbox e chaves determinísticas", () => {
  const outbox = ler("backend/src/models/IntegrationOutbox.js");
  const inbox = ler("backend/src/models/WebhookInbox.js");
  const integracao = ler("backend/src/services/omieIntegration.js");
  assert.match(outbox, /idempotencyKey/);
  assert.match(outbox, /unique:\s*true/);
  assert.match(inbox, /payloadHash/);
  assert.match(integracao, /OMIE_CONTA_PAGAR_UPSERT/);
  assert.match(integracao, /ConsultarContaPagar/);
});

test("credenciais informadas na tela são criptografadas e nunca expostas no frontend", () => {
  const configuracao = ler("backend/src/models/OmieConfiguracao.js");
  const segredos = ler("backend/src/services/omieSecrets.js");
  const rota = ler("backend/src/routes/omieIntegration.js");
  const ajustes = ler("frontend/src/omieAdjustments.js");
  assert.match(configuracao, /select:\s*false/);
  assert.match(configuracao, /criptografarSegredo/);
  assert.match(segredos, /aes-256-gcm/);
  assert.match(rota, /obterTokenWebhookAtivo/);
  assert.match(ajustes, /widget:\s*"password"/);
  assert.doesNotMatch(ajustes, /OMIE_APP_SECRET/);
});

test("erros podem ser arquivados sem permanecer nos indicadores ativos", () => {
  const outbox = ler("backend/src/models/IntegrationOutbox.js");
  const rota = ler("backend/src/routes/omieIntegration.js");
  const integracao = ler("backend/src/services/omieIntegration.js");
  assert.match(outbox, /"Arquivado"/);
  assert.match(rota, /fila\/:id\/arquivar/);
  assert.match(rota, /fila\/:id\/reprocessar/);
  assert.match(integracao, /integracoesComErro:\s*contar\(fila,\s*"Erro definitivo"\)/);
  assert.match(integracao, /integracoesArquivadas:\s*contar\(fila,\s*"Arquivado"\)/);
});

test("frontend possui dashboard, esteiras, farol e URL copiável do webhook", () => {
  const ajustes = ler("frontend/src/omieAdjustments.js");
  const celulas = ler("frontend/src/integrationCells.tsx");
  const main = ler("frontend/src/main.tsx");
  const navegacao = ler("frontend/src/prepareNavigation.js");
  assert.match(ajustes, /label:\s*"Dashboard"/);
  assert.match(ajustes, /model:\s*"IntegrationOutbox"/);
  assert.match(ajustes, /viewModes:\s*\["board",\s*"list"\]/);
  assert.match(ajustes, /Sincronizar meios de pagamento/);
  assert.match(ajustes, /Sincronizar clientes\/prestadores/);
  assert.match(celulas, /FarolIntegracaoCell/);
  assert.match(celulas, /navigator\.clipboard\.writeText/);
  assert.match(main, /farolIntegracao/);
  assert.match(main, /copiarTexto/);
  assert.match(navegacao, /"OmieBaixaPagamento"/);
  assert.doesNotMatch(ajustes, /Baixas do Omie/);
});

test("pagamentos exibem campos complementares e itens exibem pago e pendente", () => {
  const ajustes = ler("frontend/src/omieAdjustments.js");
  assert.match(ajustes, /omieDataUltimaBaixa/);
  assert.match(ajustes, /omieLiquidado/);
  assert.match(ajustes, /pagamentoTotalPago/);
  assert.match(ajustes, /pagamentoValorPendente/);
  assert.match(ajustes, /🚦 Integração/);
});
