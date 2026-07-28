"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file));

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

test("adaptador Omie expõe somente o contrato atual", () => {
  const omie = read("backend/src/integrations/omie/register.js");
  assert.match(omie, /OMIE_CLIENTES_IMPORTAR/);
  assert.match(omie, /OMIE_CONTAS_CORRENTES_IMPORTAR/);
  assert.match(omie, /OMIE_CATEGORIAS_IMPORTAR/);
  assert.match(omie, /recursos\/clientes-prestadores\/sincronizar/);
  assert.match(omie, /recursos\/contas-correntes\/sincronizar/);
  assert.doesNotMatch(omie, /meios-pagamento/);
  assert.doesNotMatch(omie, /OMIE_FORMAS_IMPORTAR/);
  assert.doesNotMatch(omie, /omieFinancialGuard/);
});

test("categoria define categoria Omie e pagamento define conta corrente", () => {
  const categoria = read("backend/src/models/Categoria.js");
  const pagamento = read("backend/src/models/Pagamento.js");
  const integracao = read("backend/src/services/omieIntegration.js");
  assert.match(categoria, /omieCategoriaId:\s*fields\.ref\("OmieCategoria"/);
  assert.doesNotMatch(categoria, /omieContaCorrenteId/);
  assert.match(pagamento, /omieContaCorrenteId:\s*fields\.ref\("OmieContaCorrente"/);
  assert.match(integracao, /resolverMapeamentoFinanceiro\(item, pagamento\)/);
  assert.match(integracao, /pagamento\.omieContaCorrenteId/);
  assert.match(integracao, /contaCorrenteId:\s*contaCorrente\.codigo/);
  assert.match(integracao, /omieContaCorrenteEnviada/);
});

test("configuração Omie contém apenas credenciais e conectividade", () => {
  const configuration = read("backend/src/models/OmieConfiguracao.js");
  const route = read("backend/src/routes/omieIntegration.js");
  assert.match(configuration, /appKey:\s*campoSegredo/);
  assert.match(configuration, /appSecret:\s*campoSegredo/);
  assert.doesNotMatch(configuration, /contaCorrenteId/);
  assert.doesNotMatch(configuration, /contaCorrenteDescricao/);
  assert.doesNotMatch(route, /contaCorrenteId/);
  assert.doesNotMatch(route, /clientes-fornecedores\/sincronizar/);
  assert.doesNotMatch(route, /sincronizar\/clientes/);
  assert.doesNotMatch(route, /fila\/processar/);
});

test("sincronização continua após erro individual e guarda rastreabilidade", () => {
  const masterData = read("backend/src/services/omieMasterData.js");
  const client = read("backend/src/services/omieClient.js");
  const history = read("backend/src/integrations/history.js");
  const execution = read("backend/src/models/IntegrationExecution.js");
  assert.match(masterData, /catch \(erro\) \{\s*registrarErro/);
  assert.match(masterData, /finally \{\s*resumo\.processados \+= 1/);
  assert.match(masterData, /if \(persistido\) resumo\.sucessos \+= 1/);
  assert.match(masterData, /resumo\.ignorados/);
  assert.match(masterData, /requisicoes/);
  assert.match(client, /request: \{ call, param:/);
  assert.match(client, /trace\.response/);
  assert.match(client, /getTraces/);
  assert.doesNotMatch(client, /request:.*app_secret/);
  assert.match(history, /Concluído com erros/);
  assert.match(history, /caught instanceof Error/);
  assert.match(history, /error\.traces = original\.traces/);
  assert.match(execution, /requests: rawArray/);
  assert.match(execution, /errors: rawArray/);
});

test("frontend mapeia categoria e seleciona conta no pagamento", () => {
  const omie = read("frontend/src/integrations/omie.js");
  const adjustments = read("frontend/src/omieAdjustments.js");
  const page = read("frontend/src/integrations/OmieIntegrationPage.tsx");
  assert.match(omie, /field:\s*"omieCategoriaId"/);
  assert.doesNotMatch(omie, /field:\s*"omieContaCorrenteId"/);
  assert.match(adjustments, /field:\s*"omieContaCorrenteId"/);
  assert.match(adjustments, /Conta corrente Omie/);
  assert.match(page, /Conta Corrente Omie é selecionada em cada Pagamento/);
  assert.match(page, /Ver diagnóstico/);
  assert.match(page, /summary\.conflitos/);
  assert.match(page, /summary\.ignorados/);
  assert.match(page, /REQUEST/);
  assert.match(page, /RESPONSE/);
});

test("forma de pagamento e componentes legados foram removidos", () => {
  const pagamento = read("backend/src/models/Pagamento.js");
  const route = read("backend/src/routes/pagamentosItem.js");
  const main = read("frontend/src/main.tsx");
  const cleanup = read("frontend/src/removePaymentMethodFields.js");

  assert.equal(exists("backend/src/models/FormaPagamento.js"), false);
  assert.equal(exists("frontend/src/paymentMethodsAdjustments.js"), false);
  assert.equal(exists("frontend/src/integrationCells.tsx"), false);
  assert.doesNotMatch(pagamento, /formaPagamento/);
  assert.doesNotMatch(route, /FormaPagamento|formaPagamento/);
  assert.match(main, /removerCamposFormaPagamento/);
  assert.match(cleanup, /collection\.model !== "FormaPagamento"/);
});
