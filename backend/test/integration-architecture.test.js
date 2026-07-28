"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("componente genérico registra provedores e resolve handlers", () => {
  const registry = read("backend/src/integrations/registry.js");
  const runtime = read("backend/src/integrations/runtime.js");
  assert.match(registry, /registerIntegrationProvider/);
  assert.match(registry, /resolveIntegrationHandler/);
  assert.match(runtime, /processIntegrationQueue/);
  assert.match(runtime, /archiveIntegrationTicket/);
  assert.match(runtime, /reprocessIntegrationTicket/);
  assert.doesNotMatch(runtime, /OMIE_CLIENTE_UPSERT/);
});

test("outbox e inbox aceitam qualquer provedor", () => {
  const outbox = read("backend/src/models/IntegrationOutbox.js");
  const inbox = read("backend/src/models/WebhookInbox.js");
  assert.match(outbox, /provider:\s*fields\.string/);
  assert.match(outbox, /handler:\s*fields\.string/);
  assert.match(outbox, /resource:\s*fields\.string/);
  assert.doesNotMatch(outbox, /fields\.enum\(TIPOS/);
  assert.match(inbox, /provider:\s*fields\.string/);
  assert.match(inbox, /resource:\s*fields\.string/);
});

test("adaptador Omie concentra catálogo e regras específicas", () => {
  const omie = read("backend/src/integrations/omie/register.js");
  assert.match(omie, /key:\s*"omie"/);
  assert.match(omie, /OMIE_CLIENTES_IMPORTAR/);
  assert.match(omie, /OMIE_CONTAS_CORRENTES_IMPORTAR/);
  assert.match(omie, /clientes-prestadores/);
  assert.match(omie, /contas-correntes/);
  assert.match(omie, /contas-pagar/);
  assert.match(omie, /runTrackedSynchronization/);
  assert.doesNotMatch(omie, /meios-pagamento/);
  assert.doesNotMatch(omie, /OMIE_FORMAS_IMPORTAR/);
});

test("histórico de sincronização é persistente e independente do Omie", () => {
  const model = read("backend/src/models/IntegrationExecution.js");
  const history = read("backend/src/integrations/history.js");
  assert.match(model, /name:\s*"IntegrationExecution"/);
  assert.match(model, /provider:\s*fields\.string/);
  assert.match(model, /resource:\s*fields\.string/);
  assert.match(history, /catalogWithLatest/);
  assert.doesNotMatch(model, /OmieSincronizacaoExecucao/);
});

test("frontend organiza Omie em Integrações com abas e modais", () => {
  const base = read("frontend/src/integrations/base.js");
  const components = read("frontend/src/integrations/components.tsx");
  const omie = read("frontend/src/integrations/omie.js");
  const page = read("frontend/src/integrations/OmieIntegrationPage.tsx");
  const navigation = read("frontend/src/prepareNavigation.js");
  const main = read("frontend/src/main.tsx");
  assert.match(base, /model:\s*"IntegrationOutbox"/);
  assert.match(base, /model:\s*"WebhookInbox"/);
  assert.match(components, /IntegrationSignalCell/);
  assert.match(omie, /path:\s*"\/integracoes\/omie"/);
  assert.match(omie, /section:\s*"Integrações"/);
  assert.match(omie, /contas-correntes/);
  assert.doesNotMatch(omie, /meios-pagamento/);
  assert.match(page, /type TabId/);
  assert.match(page, /function Modal/);
  assert.match(page, /Cadastros sincronizados/);
  assert.match(page, /Selecionar conta/);
  assert.match(navigation, /Categoria:[\s\S]*section:\s*"Configurações"/);
  assert.match(navigation, /Responsavel:[\s\S]*section:\s*"Configurações"/);
  assert.match(main, /OmieIntegrationPage/);
});
